import React from "react";
import {
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { getRadarLabelAnchor } from "../../lib/math";
import type { AnimationConfig } from "../../types/radar";
import { RADAR_MAX_RADIUS, computePhaseStarts } from "../../types/constants";

type AttributeLabelProps = {
  cx: number;
  cy: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
  index: number;
  label: string;
  color: string;
  animation: AnimationConfig;
  fontSize: number;
  fontFamily: string;
  ratingLabelFontSize: number;
  radarScale?: number;
  haloColor?: string;
};

export const AttributeLabel: React.FC<AttributeLabelProps> = ({
  cx,
  cy,
  labelOffsetX,
  labelOffsetY,
  index,
  label,
  color,
  animation,
  fontSize,
  fontFamily,
  ratingLabelFontSize,
  radarScale = 1,
  haloColor,
}) => {
  const MAX_RADIUS = RADAR_MAX_RADIUS * radarScale;
  const frame = useCurrentFrame();
  const appearFrame = computePhaseStarts(animation).labelStart + index * animation.labelStagger;

  const opacity = interpolate(frame, [appearFrame, appearFrame + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const translateY = interpolate(
    frame,
    [appearFrame, appearFrame + 10],
    [10, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );

  const pos = getRadarLabelAnchor(index, cx, cy, MAX_RADIUS, fontSize, ratingLabelFontSize);

  return (
    <text
      x={pos.x + (labelOffsetX ?? 0)}
      y={pos.y + translateY + (labelOffsetY ?? 0)}
      textAnchor="middle"
      dominantBaseline="central"
      fill={color}
      fontSize={fontSize}
      fontWeight="bold"
      fontFamily={fontFamily}
      opacity={opacity}
      paintOrder="stroke"
      stroke={haloColor ?? "none"}
      strokeWidth={haloColor ? Math.max(4, fontSize * 0.18) : 0}
      strokeLinejoin="round"
    >
      {label}
    </text>
  );
};
