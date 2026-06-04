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

  const imgSrc = src.startsWith("http") ? src : staticFile(src);

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
