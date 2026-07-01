import React from "react";
import { AbsoluteFill } from "remotion";
import type { RadarTheme } from "../../types/radar";

type VignetteProps = { theme: RadarTheme };

/**
 * 媒体背景专用的 vignette 叠加层。
 *
 * Why 独立而非复用 BackgroundGradient：现有 vignette 把 backgroundColor 加性变暗
 * 烘进单个 radial-gradient，无法用 alpha 叠加像素级等价复现（见设计决策 Q3）。
 * 媒体背景是全新路径，此处用「中心透明→边缘半透明黑」的叠加渐变做视觉近似，
 * 暗度由 vignetteBrightness（-100~0）映射为边缘 alpha。
 */
export const Vignette: React.FC<VignetteProps> = ({ theme }) => {
  if (!theme.vignetteEnabled) return null;
  const {
    vignetteBrightness, vignetteCenterX, vignetteCenterY,
    vignetteInnerStop, vignetteOuterStop,
  } = theme;
  // brightness -100..0 → 边缘黑色 alpha 0..1
  const edgeAlpha = Math.min(1, Math.max(0, -vignetteBrightness / 100));
  const background =
    `radial-gradient(circle at ${vignetteCenterX}% ${vignetteCenterY}%, ` +
    `rgba(0,0,0,0) ${vignetteInnerStop}%, ` +
    `rgba(0,0,0,${edgeAlpha}) ${vignetteOuterStop}%)`;
  return <AbsoluteFill style={{ background, pointerEvents: "none" }} />;
};
