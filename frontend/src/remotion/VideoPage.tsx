import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useRemotionEnvironment } from "remotion";
import { Video } from "@remotion/media";
import { colorKey } from "@remotion/effects/color-key";
import { BackgroundMedia } from "./Effects/BackgroundMedia";
import { isRemoteSilhouetteSrc } from "./CharacterSilhouette/Silhouette";
import type { VideoPageConfig } from "../types/radar";

/**
 * 独立视频页：主视频 + 可选色键抠像 + 底衬背景。
 *
 * 色键必须走 canvas 系 @remotion/media 的 Video（effects prop 仅它支持），
 * 且开启时预览与渲染同走一条路径保证两端结果一致；关闭时沿袭 BackgroundMedia
 * 先例：预览 OffthreadVideo（性能好）/ 渲染 Video（绕过 compositor 崩溃）。
 *
 * 音轨由 muted/volume 直接承载，与全局 BGM 天然混音（计划 D5）。
 */
export const VideoPage: React.FC<{ page: VideoPageConfig }> = ({ page }) => {
  const env = useRemotionEnvironment();
  const { background, chromaKey, audio, fit } = page;

  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: fit };
  const src = page.src ? (isRemoteSilhouetteSrc(page.src) ? page.src : staticFile(page.src)) : "";

  const effects = chromaKey.enabled
    ? [
        colorKey({
          keyColor: chromaKey.keyColor,
          similarity: chromaKey.similarity,
          smoothness: chromaKey.smoothness,
          spillSuppression: chromaKey.spillSuppression,
        }),
      ]
    : undefined;

  const useMediaVideo = chromaKey.enabled || env.isRendering;

  return (
    <AbsoluteFill>
      {background.type !== "gradient" && background.media ? (
        <BackgroundMedia type={background.type} media={background.media} />
      ) : null}
      {src ? (
        useMediaVideo ? (
          <Video
            data-testid="video-page-video"
            src={src}
            effects={effects}
            muted={audio.muted}
            volume={() => audio.volume}
            style={style}
          />
        ) : (
          <OffthreadVideo
            data-testid="video-page-video"
            src={src}
            muted={audio.muted}
            volume={() => audio.volume}
            style={style}
          />
        )
      ) : null}
    </AbsoluteFill>
  );
};
