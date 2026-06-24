/**
 * 离屏全分辨率渲染舞台：本地 MP4/WebM 导出的帧精确捕获。
 *
 * 挂载隐藏的 1920×1080 Remotion Player，逐帧 seekTo + 截图 → 编码。
 * 支持 WebCodecs MP4 输出（带音频），不支持时回退 WebM（无音频）。
 *
 * 不使用 display:none（Player 不绘制），用 fixed + left:-99999px 移出视口。
 */
"use client";

import React, { useRef, useEffect, useMemo, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import type { RadarVideoProps, MultiPageConfig } from "@/types/radar";
import { calculateDuration, calculateComparisonDuration, VIDEO_FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from "@/types/constants";
import { applyGlobalOverride } from "@/lib/global-override";
import { RadarVideo } from "@/remotion/RadarVideo";
import { MultiPageVideo } from "@/remotion/MultiPageVideo";
import { resolveMusicUrl, fetchAndDecodeAudio } from "@/lib/render-media-source";
import { renderInBrowser } from "@/lib/browser-render";
import type { AudioBuffer } from "@types/web";

export type LocalRenderMode = "single" | "multi";

export interface LocalRenderStageProps {
  /** 渲染模式：单页或全部页面 */
  mode: LocalRenderMode;
  /** 单页时：当前页 props（已合并 globalOverride） */
  props?: RadarVideoProps;
  /** 多页时：完整 config */
  config?: MultiPageConfig;
  /** 音乐 URL（来自 config.musicUrl 或外部传入） */
  musicUrl?: string;
  /** 进度回调 */
  onProgress?: (frame: number, total: number) => void;
  /** 完成回调 */
  onDone?: (result: { blob: Blob; ext: "mp4" | "webm"; durationMs: number }) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
  /** 取消信号 */
  signal?: AbortSignal;
}

/**
 * 计算多页总时长（与 PreviewPanel.calcMultiDuration 一致）。
 */
function calcMultiTotalDuration(config: MultiPageConfig): number {
  if (!config.pages.length) return 1;
  const mergedPages = config.pages.map((p) => applyGlobalOverride(p, config.globalOverride));
  const compMap = new Map<number, (typeof config.comparisons)[number]>();
  for (const c of config.comparisons) compMap.set(c.firstPageIndex, c);
  const compared = new Set<number>();
  let t = 0;
  for (let i = 0; i < config.pages.length; i++) {
    if (compared.has(i)) continue;
    const comp = compMap.get(i);
    if (comp && i + 1 < config.pages.length) {
      t += calculateComparisonDuration(mergedPages[i], mergedPages[i + 1], comp);
      compared.add(i);
      compared.add(i + 1);
    } else {
      t += calculateDuration(mergedPages[i].animation);
    }
  }
  return Math.max(1, t);
}

export const LocalRenderStage: React.FC<LocalRenderStageProps> = (stageProps) => {
  const { mode, props, config, musicUrl, onProgress, onDone, onError, signal } = stageProps;

  const playerRef = useRef<PlayerRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // 计算渲染参数
  const renderParams = useMemo(() => {
    if (mode === "single" && props) {
      return {
        component: RadarVideo as React.FC<Record<string, unknown>>,
        inputProps: props as Record<string, unknown>,
        durationInFrames: calculateDuration(props.animation),
      };
    }
    if (mode === "multi" && config) {
      return {
        component: MultiPageVideo as React.FC<Record<string, unknown>>,
        inputProps: { config },
        durationInFrames: calcMultiTotalDuration(config),
      };
    }
    return null;
  }, [mode, props, config]);

  // Player 挂载就绪后触发渲染
  useEffect(() => {
    if (!ready || !renderParams || !playerRef.current || !containerRef.current) return;

    const runRender = async () => {
      try {
        // 解析并加载音频
        const resolvedUrl = resolveMusicUrl(musicUrl);
        let audioBuffer: AudioBuffer | null = null;
        if (resolvedUrl) {
          audioBuffer = await fetchAndDecodeAudio(resolvedUrl);
        }

        // 获取捕获元素（Player 内层容器）
        const captureEl = containerRef.current!.querySelector(
          ".remotion-player-container > div",
        ) as HTMLElement;
        if (!captureEl) {
          onError?.("无法找到 Player 内层容器");
          return;
        }

        // 调用 browser-render 执行帧精确渲染
        const result = await renderInBrowser({
          playerRef: playerRef.current!,
          captureEl,
          durationInFrames: renderParams.durationInFrames,
          fps: VIDEO_FPS,
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
          audioBuffer,
          onProgress,
          signal,
        });

        onDone?.(result);
      } catch (e) {
        if (signal?.aborted) {
          onError?.("渲染已取消");
        } else {
          onError?.(e instanceof Error ? e.message : "渲染失败");
        }
      }
    };

    runRender();
  }, [ready, renderParams, musicUrl, onProgress, onDone, onError, signal]);

  // Player 就绪检测
  useEffect(() => {
    const timer = setTimeout(() => {
      if (playerRef.current && containerRef.current) {
        setReady(true);
      }
    }, 100); // 等待 Player 初始化
    return () => clearTimeout(timer);
  }, []);

  if (!renderParams) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        left: -99999,
        top: 0,
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        overflow: "hidden",
        zIndex: -9999,
        pointerEvents: "none",
      }}
    >
      <Player
        ref={playerRef}
        component={renderParams.component}
        inputProps={renderParams.inputProps}
        durationInFrames={renderParams.durationInFrames}
        fps={VIDEO_FPS}
        compositionWidth={VIDEO_WIDTH}
        compositionHeight={VIDEO_HEIGHT}
        style={{ width: VIDEO_WIDTH, height: VIDEO_HEIGHT }}
        loop={false}
        clickToPlay={false}
        showPosterWhenPaused={false}
        numberOfSharedAudioTags={0}
      />
    </div>
  );
};