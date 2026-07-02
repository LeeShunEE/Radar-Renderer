import React from "react";
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getOctagonPoint, getRadarPolygonPoints } from "../../lib/math";
import type { AnimationConfig, OverlayHighlightConfig, RadarTheme } from "../../types/radar";
import type { OverlayPhases, PhaseStarts } from "../../types/constants";
import { highlightStateAt, type OverlaySide } from "./highlight";

/** 高亮方描边加粗量（px，预览审定稿定值） */
const EMPHASIS_STROKE_BONUS = 2;
/** 常态描边宽度（px） */
const BASE_STROKE_WIDTH = 2.5;
/** 高亮时叠加第二层多边形的最大填充透明度 */
const EMPHASIS_FILL_OPACITY = 0.2;

type OverlayDotProps = {
  value: number;
  index: number;
  cx: number;
  cy: number;
  maxRadius: number;
  theme: RadarTheme;
  animation: AnimationConfig;
  fillStart: number;
};

/** 顶点圆点：fill 后段 spring 弹出；高值 = 金色大点 + 扩散光环 */
const OverlayDot: React.FC<OverlayDotProps> = ({
  value,
  index,
  cx,
  cy,
  maxRadius,
  theme,
  animation,
  fillStart,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isHighValue = value >= animation.highValueThreshold;
  const pos = getOctagonPoint(index, (value / 100) * maxRadius, cx, cy);

  const dotAppearFrame = fillStart + animation.fillDuration * 0.7 + index * 2;
  const baseScale = spring({
    fps,
    frame: frame - dotAppearFrame,
    config: { damping: 200 },
    durationInFrames: 20,
  });
  if (baseScale < 0.01) return null;

  const highValueScale = isHighValue
    ? spring({
        fps,
        frame: frame - (dotAppearFrame + animation.fillDuration * 0.3 + index * 3),
        config: { damping: animation.highValueSpringDamping, mass: 0.8 },
        durationInFrames: 40,
      })
    : 0;
  const radius = isHighValue ? 6 + highValueScale * 6 : 6;

  const glowAppearFrame = fillStart + animation.fillDuration * 0.8 + index * 3;
  const glowSpring = spring({
    fps,
    frame: frame - glowAppearFrame,
    config: { damping: animation.highValueSpringDamping, mass: 0.8 },
    durationInFrames: 40,
  });
  const glowOpacity = interpolate(glowSpring, [0, 0.3, 0.7, 1], [0, 0.8, 0.4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showGlow =
    isHighValue &&
    animation.highValueGlowEnabled &&
    frame >= glowAppearFrame &&
    glowOpacity > 0.01;

  return (
    <g>
      {showGlow && (
        <circle
          cx={pos.x}
          cy={pos.y}
          r={6 + glowSpring * 40}
          fill="none"
          stroke={theme.glowColor}
          strokeWidth={2}
          opacity={glowOpacity}
        />
      )}
      <circle
        cx={pos.x}
        cy={pos.y}
        r={radius * baseScale}
        fill={isHighValue ? theme.highValueDotColor : theme.dotColor}
      />
    </g>
  );
};

type OverlayFillProps = {
  values: number[];
  side: OverlaySide;
  theme: RadarTheme;
  /** 双方共用的绘制节奏（对比左页的 animation） */
  animation: AnimationConfig;
  phaseStarts: PhaseStarts;
  phases: OverlayPhases;
  overlay: OverlayHighlightConfig;
  cx: number;
  cy: number;
  maxRadius: number;
};

/**
 * 叠加图中单方的八边形 + 顶点圆点：随 fill 进度从中心展开；
 * 高亮时描边加粗、填充增浓、加光晕，被压暗时整体降透明度。
 */
export const OverlayFill: React.FC<OverlayFillProps> = ({
  values,
  side,
  theme,
  animation,
  phaseStarts,
  phases,
  overlay,
  cx,
  cy,
  maxRadius,
}) => {
  const frame = useCurrentFrame();
  const { emphasis, opacity } = highlightStateAt(frame, side, phases, overlay);

  const progress = interpolate(
    frame,
    [phaseStarts.fillStart, phaseStarts.fillEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.45, 0, 0.55, 1),
    },
  );
  const points = getRadarPolygonPoints(
    values.map((v) => v * progress),
    maxRadius,
    cx,
    cy,
  );

  return (
    <g opacity={opacity}>
      <polygon
        points={points}
        fill={theme.gridFillColor}
        stroke={theme.gridStrokeColor}
        strokeWidth={BASE_STROKE_WIDTH + EMPHASIS_STROKE_BONUS * emphasis}
        strokeLinejoin="round"
        style={{
          filter:
            emphasis > 0.01
              ? `drop-shadow(0 0 ${overlay.glowRadius * emphasis}px ${theme.gridStrokeColor})`
              : undefined,
        }}
      />
      {emphasis > 0.01 && (
        // 填充增浓：gridFillColor 自带 alpha 无法直接调浓，不解析颜色字符串，
        // 叠一层描边色低透明度的多边形实现
        <polygon
          points={points}
          fill={theme.gridStrokeColor}
          fillOpacity={emphasis * EMPHASIS_FILL_OPACITY}
          stroke="none"
        />
      )}
      {values.map((v, i) => (
        <OverlayDot
          key={i}
          value={v}
          index={i}
          cx={cx}
          cy={cy}
          maxRadius={maxRadius}
          theme={theme}
          animation={animation}
          fillStart={phaseStarts.fillStart}
        />
      ))}
    </g>
  );
};
