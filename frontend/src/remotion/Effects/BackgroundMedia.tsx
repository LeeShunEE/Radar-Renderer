import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useVideoConfig, useRemotionEnvironment } from "remotion";
import { Video } from "@remotion/media";
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
 * 预览时使用 OffthreadVideo（性能更好）；渲染时使用 @remotion/media 的 Video 组件
 * （绕过 compositor 崩溃问题，使用浏览器解码）。
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
  // fps 仅用于 video 分支的 trimBefore 换算，但 Hook 必须在顶层调用（Rules of Hooks），不能移入 video 分支内。
  const { fps } = useVideoConfig();
  const env = useRemotionEnvironment();

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

  // 预览时使用 OffthreadVideo，渲染时使用 @remotion/media 的 Video
  // 这避免了 compositor 在处理某些视频格式时崩溃的问题
  const videoComponent = env.isRendering ? (
    <Video
      data-testid="background-media-video"
      src={src}
      muted
      loop={media.videoOptions.loop}
      playbackRate={media.videoOptions.playbackRate}
      startFrom={Math.round((media.videoOptions.startFrom / 1000) * fps)}
      style={commonStyle}
    />
  ) : (
    <OffthreadVideo
      data-testid="background-media-video"
      src={src}
      muted
      loop={media.videoOptions.loop}
      playbackRate={media.videoOptions.playbackRate}
      trimBefore={Math.round((media.videoOptions.startFrom / 1000) * fps)}
      style={commonStyle}
    />
  );

  return (
    <AbsoluteFill>
      {type === "video" ? videoComponent : (
        <Img data-testid="background-media-image" src={src} style={commonStyle} />
      )}
    </AbsoluteFill>
  );
};
