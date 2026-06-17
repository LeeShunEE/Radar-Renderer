// Node 渲染 worker：内部 HTTP 服务，复用 frontend/src/remotion 的 Remotion 产物。
// 仅供 FastAPI 后端内部调用（并发由后端信号量控制，此处一次请求渲染一个任务）。
//
// 请求：POST /render { mode: "single"|"multi", codec: "h264"|"gif",
//                      outputPath: <绝对路径>, inputProps: <图表配置> }
// 响应：200 { outputPath, durationMs } | 4xx/5xx { error }
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

async function handleRender(body) {
  const { mode = "single", codec = "h264", outputPath, inputProps } = body;
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
    onProgress: () => {},
  });

  return { outputPath, durationMs: Date.now() - startedAt };
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
