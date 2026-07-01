import React from "react";
import { Audio, staticFile, useVideoConfig } from "remotion";
import type { BackgroundMediaConfig } from "../../types/radar";
import { isRemoteSilhouetteSrc } from "../CharacterSilhouette/Silhouette";

type BackgroundAudioProps = { media: BackgroundMediaConfig };

/**
 * 解析媒体 src：远程/blob/data 原样，相对路径走 staticFile（与剪影/BackgroundMedia 同规则）。
 *
 * Args:
 *   src: 媒体路径或 URL
 *
 * Returns:
 *   可直接传给 Audio 的 src 字符串
 */
function resolveSrc(src: string): string {
  return isRemoteSilhouetteSrc(src) ? src : staticFile(src);
}

/**
 * 背景视频音轨（仅服务端渲染出声）。
 *
 * Why 独立于 BackgroundMedia：OffthreadVideo 无音轨，声音须由并行 <Audio> 承载。
 * 服务端 renderMedia 会自动把本 <Audio> 混入成片；客户端 WebCodecs 即时导出
 * 不经 Remotion 渲染管线，背景视频音频暂不支持（见设计决策 Q9 / Option B）。
 * 由 videoOptions.muted 控制（默认 true=静音）。
 *
 * Args:
 *   media: BackgroundMediaConfig，含 src / videoOptions.muted / loop / playbackRate / startFrom
 *
 * Returns:
 *   Audio 元素，muted=true 或空 src 时返回 null
 */
export const BackgroundAudio: React.FC<BackgroundAudioProps> = ({ media }) => {
  const { fps } = useVideoConfig();

  if (!media.src || media.videoOptions.muted) return null;

  return (
    <Audio
      src={resolveSrc(media.src)}
      loop={media.videoOptions.loop}
      playbackRate={media.videoOptions.playbackRate}
      // startFrom 毫秒 → 帧（与 BackgroundMedia OffthreadVideo 的 trimBefore 换算一致）
      trimBefore={Math.round((media.videoOptions.startFrom / 1000) * fps)}
    />
  );
};
