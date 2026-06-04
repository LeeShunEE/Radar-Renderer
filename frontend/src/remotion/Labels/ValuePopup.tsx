import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { getOctagonPoint } from "../../lib/math";
import type { AnimationConfig } from "../../types/radar";
import { RADAR_MAX_RADIUS, computePhaseStarts } from "../../../types/constants";

const MAX_RADIUS = RADAR_MAX_RADIUS;

type ValuePopupProps = {
  cx: number;
  cy: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
  index: number;
  value: number;
  color: string;
  animation: AnimationConfig;
  fontSize: number;
  fontFamily: string;
};

function useSpringStyle(frame: number, fps: number, appearFrame: number) {
  return spring({
    fps,
    frame: frame - appearFrame,
    config: { damping: 12, mass: 0.6 },
    durationInFrames: 25,
  });
}

function useBounceStyle(frame: number, _fps: number, appearFrame: number) {
  const t = Math.max(0, frame - appearFrame);
  const progress = Math.min(t / 25, 1);
  const bounceEased = progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  const bounce = progress < 1
    ? bounceEased + Math.abs(Math.sin(progress * Math.PI * 3)) * (1 - progress) * 0.3
    : 1;
  return { opacity: Math.min(progress * 4, 1), translateY: (1 - bounce) * 30, scale: bounce };
}

function useFadeScaleStyle(frame: number, _fps: number, appearFrame: number) {
  const t = Math.max(0, frame - appearFrame);
  const progress = Math.min(t / 20, 1);
  const eased = 1 - Math.pow(1 - progress, 3);
  return { opacity: eased, scale: 0.3 + eased * 0.7 };
}

function useSlideInStyle(frame: number, _fps: number, appearFrame: number) {
  const t = Math.max(0, frame - appearFrame);
  const progress = Math.min(t / 20, 1);
  const eased = 1 - Math.pow(1 - progress, 3);
  return { opacity: eased, translateY: -20 * (1 - eased), scale: 1 };
}

export const ValuePopup: React.FC<ValuePopupProps> = ({
  cx,
  cy,
  labelOffsetX,
  labelOffsetY,
  index,
  value,
  color,
  animation,
  fontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!animation.valuePopupEnabled) return null;

  const appearFrame = computePhaseStarts(animation).effectsStart + index * 3;

  const normalizedValue = (value / 100) * MAX_RADIUS;
  const pos = getOctagonPoint(index, normalizedValue, cx, cy);

  const offset = fontSize * 0.9 + 5;
  const offsetX = pos.x > cx ? offset : -offset;
  const offsetY = pos.y > cy ? offset : -offset;

  const tx = pos.x + offsetX + (labelOffsetX ?? 0);
  const ty = pos.y + offsetY + (labelOffsetY ?? 0);

  const style = animation.valuePopupStyle;

  if (style === "spring") {
    const scaleVal = useSpringStyle(frame, fps, appearFrame);
    if (scaleVal < 0.01) return null;
    return (
      <text
        x={tx}
        y={ty}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={fontSize}
        fontWeight="bold"
        fontFamily={fontFamily}
        opacity={scaleVal}
        transform={`translate(${tx}, ${ty}) scale(${scaleVal}) translate(${-tx}, ${-ty})`}
      >
        {value}
      </text>
    );
  }

  if (style === "bounce") {
    const { opacity, translateY, scale } = useBounceStyle(frame, fps, appearFrame);
    if (opacity < 0.01) return null;
    return (
      <text
        x={tx}
        y={ty + translateY}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={fontSize}
        fontWeight="bold"
        fontFamily={fontFamily}
        opacity={opacity}
        transform={`translate(${tx}, ${ty + translateY}) scale(${scale}) translate(${-tx}, ${-(ty + translateY)})`}
      >
        {value}
      </text>
    );
  }

  if (style === "fadeScale") {
    const { opacity, scale } = useFadeScaleStyle(frame, fps, appearFrame);
    if (opacity < 0.01) return null;
    return (
      <text
        x={tx}
        y={ty}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={fontSize}
        fontWeight="bold"
        fontFamily={fontFamily}
        opacity={opacity}
        transform={`translate(${tx}, ${ty}) scale(${scale}) translate(${-tx}, ${-ty})`}
      >
        {value}
      </text>
    );
  }

  if (style === "slideIn") {
    const { opacity, translateY } = useSlideInStyle(frame, fps, appearFrame);
    if (opacity < 0.01) return null;
    return (
      <text
        x={tx}
        y={ty + translateY}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={fontSize}
        fontWeight="bold"
        fontFamily={fontFamily}
        opacity={opacity}
      >
        {value}
      </text>
    );
  }

  return null;
};
