/**
 * 浏览器端本地渲染引擎：从 Player 逐帧截图 → MediaRecorder 编码 WebM。
 *
 * 限制：
 * - 仅输出 WebM（非 MP4/GIF）
 * - 无音频轨道
 * - 渲染质量取决于浏览器
 */
import { toCanvas } from "html-to-image";

export interface BrowserRenderOptions {
  /** Player 容器 DOM 元素。 */
  containerElement: HTMLElement;
  /** 总帧数。 */
  durationInFrames: number;
  /** 帧率。 */
  fps: number;
  /** 输出分辨率宽度。 */
  width: number;
  /** 输出分辨率高度。 */
  height: number;
  /** 进度回调。 */
  onProgress?: (frame: number, total: number) => void;
}

export interface BrowserRenderResult {
  /** 输出 Blob。 */
  blob: Blob;
  /** 总耗时（毫秒）。 */
  durationMs: number;
}

/**
 * 执行浏览器端渲染。
 *
 * 实现方案：
 * 1. 创建 offscreen canvas 作为渲染目标
 * 2. 遍历每一帧，通过 seekTo 让 Player 渲染该帧
 * 3. 使用 html-to-image 将 Player 容器截图到 canvas
 * 4. MediaRecorder 编码 WebM VP9
 */
export async function renderInBrowser(
  options: BrowserRenderOptions,
): Promise<BrowserRenderResult> {
  const {
    containerElement,
    durationInFrames,
    fps,
    width,
    height,
    onProgress,
  } = options;

  const startTime = performance.now();

  // 创建 offscreen canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建 canvas context");
  }

  // 准备 MediaRecorder
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType: "video/webm;codecs=vp9",
    videoBitsPerSecond: 5000000, // 5 Mbps
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  recorder.start();

  // 逐帧渲染
  for (let frame = 0; frame < durationInFrames; frame++) {
    // 等待 Player 渲染该帧（通过 seekTo）
    // 注意：seekTo 由调用方在传入 containerElement 前设置
    await waitForFrameRender(containerElement, frame, fps);

    // 截图到 canvas
    await captureToCanvas(containerElement, canvas, ctx, width, height);

    // 进度回调
    if (onProgress) {
      onProgress(frame + 1, durationInFrames);
    }
  }

  // 停止录制
  recorder.stop();

  // 等待录制完成
  const blob = await new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const finalBlob = new Blob(chunks, { type: "video/webm" });
      resolve(finalBlob);
    };
  });

  const endTime = performance.now();

  return {
    blob,
    durationMs: endTime - startTime,
  };
}

/**
 * 等待 Player 渲染指定帧。
 *
 * 由于 seekTo 是同步的但渲染是异步的，需要等待一段时间让帧渲染完成。
 * 这里使用简单的 setTimeout 来等待，实际时间取决于帧复杂度。
 */
async function waitForFrameRender(
  _element: HTMLElement,
  _frame: number,
  fps: number,
): Promise<void> {
  // 每帧等待约 1/fps 秒（让渲染完成）
  // 实际 seekTo 由 Player 控制，这里只是等待渲染
  const waitMs = 1000 / fps;
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}

/**
 * 将 Player 容器截图到 canvas。
 */
async function captureToCanvas(
  element: HTMLElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): Promise<void> {
  // 使用 html-to-image 截图
  const imgDataUrl = await toCanvas(element, {
    width: element.clientWidth,
    height: element.clientHeight,
    quality: 1,
  });

  // 绘制到 canvas（缩放到目标分辨率）
  ctx.clearRect(0, 0, width, height);
  const img = new Image();
  img.src = imgDataUrl.toDataURL();
  await new Promise((resolve) => {
    img.onload = resolve;
  });
  ctx.drawImage(img, 0, 0, width, height);
}