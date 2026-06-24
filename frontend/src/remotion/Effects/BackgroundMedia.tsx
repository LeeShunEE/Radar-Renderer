import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useVideoConfig } from "remotion";
import type { BackgroundMediaConfig } from "../../types/radar";
import { isRemoteSilhouetteSrc } from "../CharacterSilhouette/Silhouette";

type BackgroundMediaProps = {
  type: "image" | "video";
  media: BackgroundMediaConfig;
};

const SCALE_TO_FIT: Record<BackgroundMediaConfig["scale"], React.CSSProperties["objectFit"]> = {
  cover: "cover",
  contain: "contain",
  fill: "fill",
};

/**
 * 解析媒体 src：远程/blob/data 原样，相对路径走 staticFile（与剪影同规则）。
 *
 * Args:
 *   src: 媒体路径或 URL
 *
 * Returns:
 *   可直接传给 Img/OffthreadVideo 的 src 字符串
 */
function resolveSrc(src: string): string {
  return isRemoteSilhouetteSrc(src) ? src : staticFile(src);
}

/**
 * 纯视觉背景媒体组件，支持图片与视频背景（无音轨）。
 *
 * OffthreadVideo 无音轨；声音由 musicUrl/独立 Audio 负责（阶段 7）。
 *
 * Args:
 *   type: "image" | "video"
 *   media: BackgroundMediaConfig，含 src/opacity/blur/scale/position/videoOptions
 *
 * Returns:
 *   AbsoluteFill 包裹的背景层，src 为空时返回 null
 */
export const BackgroundMedia: React.FC<BackgroundMediaProps> = ({ type, media }) => {
  const { fps } = useVideoConfig();

  if (!media.src) return null;

  const commonStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: SCALE_TO_FIT[media.scale],
    objectPosition: media.position,
    opacity: media.opacity,
    filter: media.blur > 0 ? `blur(${media.blur}px)` : undefined,
  };

  const src = resolveSrc(media.src);

  return (
    <AbsoluteFill>
      {type === "video" ? (
        // OffthreadVideo 无音轨；声音由 musicUrl/独立 Audio 负责（阶段 7）。
        <OffthreadVideo
          src={src}
          muted
          loop={media.videoOptions.loop}
          playbackRate={media.videoOptions.playbackRate}
          trimBefore={Math.round((media.videoOptions.startFrom / 1000) * fps)}
          style={commonStyle}
        />
      ) : (
        <Img src={src} style={commonStyle} />
      )}
    </AbsoluteFill>
  );
};
