import React from "react";
import {
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

type SilhouetteProps = {
  src: string;
  opacity: number;
  delay: number;
  fadeInDuration: number;
  offsetX?: number;
  offsetY?: number;
  scaleMultiplier?: number;
  fadeFromFrame?: number;
  fadeOutDuration?: number;
  targetOpacityOverride?: number;
};

/**
 * 判断剪影 src 是否为"绝对/特殊协议 URL"，应原样交给 <Img>，
 * 否则视为相对路径交给 Remotion staticFile 解析。
 *
 * 为何单独抽函数：预览阶段 PreviewPanel 会把鉴权上传图本地化为 blob: URL
 * （useUploadObjectUrls），data: 兼容未来 base64 内嵌，http(s): 保持原绝对 URL 行为。
 * 若把 blob:/data: 误当相对路径丢给 staticFile，Remotion 会做路径化处理，
 * 浏览器最终请求 `<origin>/blob:...`（冒号被编码 %3A）导致 404。
 */
export function isRemoteSilhouetteSrc(src: string): boolean {
  return /^(https?:|blob:|data:)/i.test(src);
}

export const Silhouette: React.FC<SilhouetteProps> = ({
  src,
  opacity,
  delay,
  fadeInDuration,
  offsetX,
  offsetY,
  scaleMultiplier,
  fadeFromFrame,
  fadeOutDuration,
  targetOpacityOverride,
}) => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [delay, delay + fadeInDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const scale = interpolate(frame, [delay, delay + fadeInDuration], [0.95, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  let effectiveOpacity = fadeIn * opacity;
  if (fadeFromFrame !== undefined && targetOpacityOverride !== undefined) {
    const t = interpolate(
      frame,
      [fadeFromFrame, fadeFromFrame + (fadeOutDuration ?? 15)],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) },
    );
    effectiveOpacity = fadeIn * (opacity * (1 - t) + targetOpacityOverride * t);
  }

  if (!src || fadeIn < 0.01) return null;

  const imgSrc = isRemoteSilhouetteSrc(src) ? src : staticFile(src);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "50%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        paddingTop: "5%",
        opacity: effectiveOpacity,
        transform: `translate(${offsetX ?? 0}px, ${offsetY ?? 0}px) scale(${scale * (scaleMultiplier ?? 1)})`,
      }}
    >
      <Img
        src={imgSrc}
        style={{
          maxHeight: "55%",
          maxWidth: "80%",
          objectFit: "contain",
        }}
      />
    </div>
  );
};
