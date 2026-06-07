/**
 * 本地渲染 hook：在浏览器中逐帧截图 → MediaRecorder 编码 WebM。
 */
import { useState, useCallback, useRef } from "react";
import type { RadarVideoProps, MultiPageConfig } from "@/types/radar";
import { applyGlobalOverride } from "@/lib/global-override";
import { renderInBrowser } from "@/lib/browser-render";
import { calculateDuration, VIDEO_FPS } from "@/types/constants";

export interface UseLocalRenderResult {
  /** 是否正在渲染。 */
  rendering: boolean;
  /** 渲染进度（0-100）。 */
  progress: number;
  /** 错误信息。 */
  error: string | null;
  /** 开始本地渲染。 */
  startLocalRender: (props: RadarVideoProps, config: MultiPageConfig) => void;
  /** 取消渲染。 */
  cancel: () => void;
}

export function useLocalRender(): UseLocalRenderResult {
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  /** 开始本地渲染。 */
  const startLocalRender = useCallback(async (
    props: RadarVideoProps,
    config: MultiPageConfig,
  ) => {
    setRendering(true);
    setProgress(0);
    setError(null);
    cancelledRef.current = false;

    try {
      // 合并全局覆盖
      const mergedProps = applyGlobalOverride(props, config.globalOverride);

      // 计算渲染参数
      const durationInFrames = calculateDuration(mergedProps.animation);
      // 使用固定分辨率（本地渲染默认 1080p）
      const width = 1920;
      const height = 1080;

      // 获取 Player 容器元素
      // 注意：这里假设 Player 容器有特定 ID，实际需要调用方传入或约定
      const containerElement = document.querySelector(
        ".remotion-player-container",
      ) as HTMLElement;

      if (!containerElement) {
        throw new Error("找不到 Player 容器元素");
      }

      // 执行渲染
      const result = await renderInBrowser({
        containerElement,
        durationInFrames,
        fps: VIDEO_FPS,
        width,
        height,
        onProgress: (frame, total) => {
          if (cancelledRef.current) {
            throw new Error("渲染已取消");
          }
          setProgress((frame / total) * 100);
        },
      });

      // 下载产物
      const blobUrl = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${props.characterName || "radar"}.webm`;
      a.click();
      URL.revokeObjectURL(blobUrl);

      setRendering(false);
      setProgress(100);
    } catch (e) {
      if (cancelledRef.current) {
        setError("渲染已取消");
      } else {
        setError(e instanceof Error ? e.message : "渲染失败");
      }
      setRendering(false);
    }
  }, []);

  /** 取消渲染。 */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setRendering(false);
    setError("渲染已取消");
  }, []);

  return {
    rendering,
    progress,
    error,
    startLocalRender,
    cancel,
  };
}