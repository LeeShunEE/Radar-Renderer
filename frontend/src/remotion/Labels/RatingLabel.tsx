import React from "react";
import {
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { getRadarLabelAnchor } from "../../lib/math";
import { calculateRating, getRatingColor } from "../../lib/rating";
import type { AnimationConfig } from "../../types/radar";
import { RADAR_MAX_RADIUS, computePhaseStarts } from "../../../types/constants";

const MAX_RADIUS = RADAR_MAX_RADIUS;
type RatingLabelProps = {
  cx: number;
  cy: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
  index: number;
  value: number;
  animation: AnimationConfig;
  fontSize: number;
  fontFamily: string;
  attributeLabelFontSize: number;
  fadeOutAtFrame?: number;
  fadeOutDuration?: number;
  haloColor?: string;
};

export const RatingLabel: React.FC<RatingLabelProps> = ({
  cx,
  cy,
  labelOffsetX,
  labelOffsetY,
  index,
  value,
  animation,
  fontSize,
  fontFamily,
  attributeLabelFontSize,
  fadeOutAtFrame,
  fadeOutDuration = 10,
  haloColor,
}) => {
  const frame = useCurrentFrame();
  const appearFrame = computePhaseStarts(animation).labelStart + index * animation.labelStagger + 5;

  const appearOpacity = interpolate(frame, [appearFrame, appearFrame + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const fadeOutOpacity =
    fadeOutAtFrame !== undefined
      ? interpolate(
          frame,
          [fadeOutAtFrame, fadeOutAtFrame + Math.max(1, fadeOutDuration)],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 1;
  const opacity = appearOpacity * fadeOutOpacity;

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

  const rating = calculateRating(value);
  const color = getRatingColor(rating);
  const pos = getRadarLabelAnchor(index, cx, cy, MAX_RADIUS, attributeLabelFontSize, fontSize);

  return (
    <text
      x={pos.x + (labelOffsetX ?? 0)}
      y={pos.y + pos.yOffset + translateY + (labelOffsetY ?? 0)}
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
      {rating.full}
    </text>
  );
};
