/**
 * 本地渲染 hook：在浏览器中逐帧截图 → WebCodecs MP4 或 WebM。
 *
 * 新签名：startLocalRender(mode, props, config)
 * 内部状态管理：request 用于触发 LocalRenderStage 渲染
 * 取消：通过 AbortController
 * 下载：文件名按返回 ext 用 .mp4/.webm
 */
import { useState, useCallback, useRef, type ReactNode } from "react";
import type { RadarVideoProps, MultiPageConfig } from "@/types/radar";
import { LocalRenderStage, type LocalRenderMode } from "@/components/editor/LocalRenderStage";
import { applyGlobalOverride } from "@/lib/global-override";

export interface UseLocalRenderResult {
  /** 是否正在渲染 */
  rendering: boolean;
  /** 渲染进度（0-100） */
  progress: number;
  /** 错误信息 */
  error: string | null;
  /** 是否支持 MP4 输出（探测后更新） */
  mp4Supported: boolean | null;
  /** 开始本地渲染 */
  startLocalRender: (mode: LocalRenderMode, props: RadarVideoProps, config: MultiPageConfig) => void;
  /** 取消渲染 */
  cancel: () => void;
  /** 渲染 LocalRenderStage（在调用方组件内渲染） */
  renderStage: () => ReactNode | null;
}

export function useLocalRender(): UseLocalRenderResult {
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mp4Supported, setMp4Supported] = useState<boolean | null>(null);

  // 渲染请求状态（触发 LocalRenderStage）
  const requestRef = useRef<{
    mode: LocalRenderMode;
    props: RadarVideoProps;
    config: MultiPageConfig;
    signal: AbortController;
  } | null>(null);

  const musicUrlRef = useRef<string | undefined>(undefined);

  /** 开始本地渲染 */
  const startLocalRender = useCallback((
    mode: LocalRenderMode,
    props: RadarVideoProps,
    config: MultiPageConfig,
  ) => {
    setRendering(true);
    setProgress(0);
    setError(null);

    // 创建取消信号
    const signal = new AbortController();
    requestRef.current = { mode, props, config, signal };

    // 提取音乐 URL
    musicUrlRef.current = config.musicUrl;

    // MP4 支持探测在 LocalRenderStage 内完成，这里先设为 null
    setMp4Supported(null);
  }, []);

  /** 取消渲染 */
  const cancel = useCallback(() => {
    if (requestRef.current) {
      requestRef.current.signal.abort();
      requestRef.current = null;
    }
    setRendering(false);
    setError("渲染已取消");
  }, []);

  /** 进度回调 */
  const handleProgress = useCallback((frame: number, total: number) => {
    const pct = (frame / total) * 100;
    setProgress(Math.min(100, pct));
  }, []);

  /** 完成回调 */
  const handleDone = useCallback((result: { blob: Blob; ext: "mp4" | "webm"; durationMs: number }) => {
    // 先保存请求信息，再清空 requestRef（避免 TypeScript 类型收窄为 never）
    const req = requestRef.current;
    const mode = req?.mode;
    const props = req?.props;
    const config = req?.config;

    setRendering(false);
    setProgress(100);
    setMp4Supported(result.ext === "mp4");
    requestRef.current = null;

    // 下载产物
    const blobUrl = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = blobUrl;

    // 文件名：从 props 取角色名或用 "radar"
    const name = mode === "single" && props
      ? props.characterName || "radar"
      : config?.pages.map((p) => p.characterName).join("-") || "multi";

    a.download = `${name}.${result.ext}`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }, []);

  /** 错误回调 */
  const handleError = useCallback((err: string) => {
    setRendering(false);
    setError(err);
    requestRef.current = null;
  }, []);

  /** 渲染 LocalRenderStage（当有请求时） */
  const renderStage = useCallback(() => {
    const req = requestRef.current;
    if (!req) return null;

    // 合并 globalOverride（单页模式）
    const mergedProps = req.mode === "single"
      ? applyGlobalOverride(req.props, req.config.globalOverride)
      : undefined;

    return (
      <LocalRenderStage
        mode={req.mode}
        props={mergedProps}
        config={req.config}
        musicUrl={musicUrlRef.current}
        onProgress={handleProgress}
        onDone={handleDone}
        onError={handleError}
        signal={req.signal.signal}
      />
    );
  }, [handleProgress, handleDone, handleError]);

  return {
    rendering,
    progress,
    error,
    mp4Supported,
    startLocalRender,
    cancel,
    renderStage,
  };
}