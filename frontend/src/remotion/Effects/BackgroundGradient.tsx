import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import type { RadarTheme } from "../../types/radar";

type BackgroundGradientProps = {
  theme: RadarTheme;
};

export const BackgroundGradient: React.FC<BackgroundGradientProps> = ({
  theme,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const {
    vignetteEnabled,
    vignetteBrightness,
    vignetteCenterX,
    vignetteCenterY,
    vignetteInnerStop,
    vignetteOuterStop,
    backgroundColor,
  } = theme;

  const background = vignetteEnabled
    ? `radial-gradient(circle at ${vignetteCenterX}% ${vignetteCenterY}%, ${backgroundColor} ${vignetteInnerStop}%, ${adjustBrightness(backgroundColor, vignetteBrightness)} ${vignetteOuterStop}%)`
    : backgroundColor;

  return (
    <AbsoluteFill
      style={{
        opacity,
        background,
      }}
    />
  );
};

function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
