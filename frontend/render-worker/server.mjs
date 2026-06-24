// Node 渲染 worker：内部 HTTP 服务，复用 frontend/src/remotion 的 Remotion 产物。
// 仅供 FastAPI 后端内部调用（并发由后端信号量控制，此处一次请求渲染一个任务）。
//
// 请求：POST /render { mode: "single"|"multi", codec: "h264"|"gif",
//                      outputPath: <绝对路径>, inputProps: <图表配置> }
// 响应：200 { outputPath, durationMs, totalFrames } | 4xx/5xx { error }
//
// 启动：cd frontend && node render-worker/server.mjs   （或 pnpm worker）
// 环境变量：WORKER_PORT（默认 3100）

import http from "node:http";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
// 复用 frontend/src/remotion 的 webpack 覆盖（启用 Tailwind v4），
// 否则 src/remotion/index.ts 里的 `@import "tailwindcss"` 无法被处理。
import { webpackOverride } from "../src/remotion/webpack-override.mjs";

// 与 frontend/src/types/constants.ts 的 COMP_NAME / MULTI_COMP_NAME 保持一致。
// 此处内联以让 worker 在纯 node 下运行（无需 TS loader）；Remotion bundler 自行处理组件 TS 树。
const COMP_NAME = "RadarChartVideo";
const MULTI_COMP_NAME = "MultiPageRadarVideo";

const PORT = Number(process.env.WORKER_PORT ?? 3100);
const ENTRY = path.resolve(process.cwd(), "src", "remotion", "index.ts");
const PUBLIC_DIR = path.resolve(process.cwd(), "public");
// 进度反向回调：worker 在渲染过程中把帧进度 POST 回后端内部端点。
// compose 内网调用 backend；本地直跑默认 localhost:8000。
const BACKEND_INTERNAL_URL =
  process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";
const RENDER_CALLBACK_TOKEN = process.env.RENDER_CALLBACK_TOKEN ?? "";
// 节流参数：至少间隔多久、或进度跨过多少比例才上报一次，避免高频打爆后端。
const PROGRESS_MIN_INTERVAL_MS = 800;
const PROGRESS_MIN_DELTA = 0.02;
// 容器内已装系统 Chromium（见 Dockerfile 的 CHROMIUM_PATH）；显式指定可执行文件，
// 否则 Remotion 会尝试把无头浏览器下载到只读的 node_modules/.remotion（EACCES）。
const BROWSER_EXECUTABLE =
  process.env.REMOTION_BROWSER_EXECUTABLE ?? process.env.CHROMIUM_PATH ?? null;

// bundle 较慢，进程内缓存复用。
let bundlePromise = null;
function getBundle() {
  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint: ENTRY,
      publicDir: PUBLIC_DIR,
      webpackOverride,
    });
  }
  return bundlePromise;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

// 节流上报渲染进度（fire-and-forget，失败绝不中断渲染）。
function makeProgressReporter(taskId, totalFrames) {
  let lastReportAt = 0;
  let lastProgress = -1;
  // taskId 缺失或未配置回调令牌时直接禁用，避免无谓请求。
  const enabled = taskId != null && RENDER_CALLBACK_TOKEN !== "";
  return ({ renderedFrames, progress }) => {
    if (!enabled) return;
    const now = Date.now();
    const crossedDelta = progress - lastProgress >= PROGRESS_MIN_DELTA;
    const elapsedEnough = now - lastReportAt >= PROGRESS_MIN_INTERVAL_MS;
    // 终帧（progress=1）始终放行，保证进度条收尾到满。
    if (progress < 1 && !crossedDelta && !elapsedEnough) return;
    lastReportAt = now;
    lastProgress = progress;
    fetch(`${BACKEND_INTERNAL_URL}/api/v1/internal/render-progress/${taskId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Render-Callback-Token": RENDER_CALLBACK_TOKEN,
      },
      body: JSON.stringify({
        rendered_frames: renderedFrames,
        total_frames: totalFrames,
      }),
    }).catch(() => {
      // 进度上报失败不影响渲染主流程，静默忽略。
    });
  };
}

async function handleRender(body) {
  const { taskId, mode = "single", codec = "h264", outputPath, inputProps } = body;
  if (!outputPath) throw new Error("缺少 outputPath");

  const serveUrl = await getBundle();
  const isMulti = mode === "multi";
  const compositionId = isMulti ? MULTI_COMP_NAME : COMP_NAME;
  const chromiumOptions = { gl: "angle", enableMultiProcessOnLinux: true };

  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps,
    chromiumOptions,
    browserExecutable: BROWSER_EXECUTABLE,
  });

  const reportProgress = makeProgressReporter(
    taskId,
    composition.durationInFrames,
  );
  const startedAt = Date.now();
  await renderMedia({
    composition,
    serveUrl,
    codec: codec === "gif" ? "gif" : "h264",
    outputLocation: outputPath,
    inputProps,
    concurrency: null,
    hardwareAcceleration: "if-possible",
    chromiumOptions,
    browserExecutable: BROWSER_EXECUTABLE,
    onProgress: reportProgress,
  });

  // durationMs 为 wall-clock 渲染耗时，totalFrames 供后端计算平均渲速（fps）。
  return {
    outputPath,
    durationMs: Date.now() - startedAt,
    totalFrames: composition.durationInFrames,
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== "POST" || req.url !== "/render") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  try {
    const body = await readJson(req);
    const result = await handleRender(body);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (error) {
    console.error("render error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error?.message ?? "render failed" }));
  }
});

server.listen(PORT, () => {
  console.log(`render-worker listening on http://localhost:${PORT}`);
});
