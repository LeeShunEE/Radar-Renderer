/**
 * 浏览器端本地渲染引擎：帧精确 seekTo + 截图 → WebCodecs MP4 或 WebM。
 *
 * 与旧版区别：
 * - 真正调用 seekTo 逐帧推进（修复旧版只 setTimeout 的 bug）
 * - 支持 MP4 输出（WebCodecs H.264 + AAC）
 * - 支持音频轨道（从 AudioBuffer 编码）
 * - 不支持 WebCodecs 时回退 WebM（无音频）
 */
import { toCanvas } from "html-to-image";
import { isMp4RenderSupported, createMp4Encoder } from "@/lib/mp4-encoder";
import type { PlayerRef } from "@remotion/player";
import { VIDEO_FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from "@/types/constants";

export interface BrowserRenderOptions {
  /** Remotion Player ref（有 seekTo 方法） */
  playerRef: PlayerRef;
  /** 要捕获的 DOM 元素（Player 内层容器） */
  captureEl: HTMLElement;
  /** 总帧数 */
  durationInFrames: number;
  /** 帧率（默认 VIDEO_FPS） */
  fps: number;
  /** 输出宽度（默认 VIDEO_WIDTH） */
  width: number;
  /** 输出高度（默认 VIDEO_HEIGHT） */
  height: number;
  /** 音频数据（可选） */
  audioBuffer?: AudioBuffer | null;
  /** 进度回调 */
  onProgress?: (frame: number, total: number) => void;
  /** 取消信号 */
  signal?: AbortSignal;
}

export interface BrowserRenderResult {
  /** 输出 Blob */
  blob: Blob;
  /** 文件扩展名（mp4 或 webm） */
  ext: "mp4" | "webm";
  /** 总耗时（毫秒） */
  durationMs: number;
}

/**
 * 执行浏览器端帧精确渲染。
 *
 * 流程：
 * 1. 探测 WebCodecs MP4 支持
 * 2. 创建 MP4 编码器或 WebM MediaRecorder
 * 3. 逐帧 seekTo + 等待绘制 + 截图 + 编码
 * 4. 编码音轨（如有 audioBuffer）
 * 5. 返回 {blob, ext, durationMs}
 */
export async function renderInBrowser(options: BrowserRenderOptions): Promise<BrowserRenderResult> {
  const {
    playerRef,
    captureEl,
    durationInFrames,
    fps = VIDEO_FPS,
    width = VIDEO_WIDTH,
    height = VIDEO_HEIGHT,
    audioBuffer,
    onProgress,
    signal,
  } = options;

  const startTime = performance.now();

  // 探测 MP4 支持
  const mp4Supported = await isMp4RenderSupported(
    audioBuffer?.sampleRate,
    audioBuffer?.numberOfChannels,
  );

  // 创建编码器
  let ext: "mp4" | "webm" = "mp4";
  let encoder: ReturnType<typeof createMp4Encoder> | null = null;
  let webmRecorder: MediaRecorder | null = null;
  const webmChunks: Blob[] = [];
  let webmStream: MediaStream | null = null;

  // 固定捕获画布
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建 canvas context");

  if (mp4Supported) {
    encoder = createMp4Encoder({
      width,
      height,
      fps,
      audioBuffer,
    });
  } else {
    // WebM fallback（无音频）
    ext = "webm";
    webmStream = canvas.captureStream(fps);
    webmRecorder = new MediaRecorder(webmStream, {
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 5e6,
    });
    webmRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) webmChunks.push(e.data);
    };
    webmRecorder.start();
  }

  try {
    // 逐帧渲染
    for (let frame = 0; frame < durationInFrames; frame++) {
      if (signal?.aborted) throw new Error("渲染已取消");

      // seekTo 让 Player 渲染该帧
      playerRef.seekTo(frame);

      // 等待绘制：2×RAF（Remotion 重绘）
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));

      // 截图到 canvas
      const imgCanvas = await toCanvas(captureEl, {
        width,
        height,
        quality: 1,
      });
      ctx.clearRect(0, 0, width, height);
      const img = new Image();
      img.src = imgCanvas.toDataURL();
      await new Promise((r) => { img.onload = r; });
      ctx.drawImage(img, 0, 0, width, height);

      // 编码
      if (encoder) {
        await encoder.addFrame(canvas, frame);
      } else if (webmRecorder && webmStream) {
        // WebM: 推送帧到 stream
        const track = webmStream.getVideoTracks()[0] as unknown as { requestFrame?: () => void };
        if (track?.requestFrame) {
          track.requestFrame();
        }
      }

      onProgress?.(frame + 1, durationInFrames);
    }

    // 完成编码
    let blob: Blob;
    if (encoder) {
      blob = await encoder.finalize();
    } else if (webmRecorder) {
      webmRecorder.stop();
      blob = await new Promise<Blob>((resolve) => {
        webmRecorder!.onstop = () => {
          resolve(new Blob(webmChunks, { type: "video/webm" }));
        };
      });
    } else {
      throw new Error("编码器未初始化");
    }

    const endTime = performance.now();
    return { blob, ext, durationMs: endTime - startTime };
  } catch (e) {
    // 清理
    if (encoder) {
      // encoder 已在 finalize 或错误时关闭
    }
    if (webmRecorder && webmRecorder.state !== "inactive") {
      webmRecorder.stop();
    }
    throw e;
  }
}