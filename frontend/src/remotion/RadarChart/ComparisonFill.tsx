import React from "react";
import {
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { getRadarPolygonPoints } from "../../lib/math";
import type { RadarAttribute, RadarTheme } from "../../types/radar";
import { RADAR_MAX_RADIUS } from "../../types/constants";

type ComparisonFillProps = {
  cx: number;
  cy: number;
  leftAttributes: RadarAttribute[];
  rightAttributes: RadarAttribute[];
  theme: RadarTheme;
  polygonMode: "expand" | "extend";
  fillDuration: number;
  radarScale?: number;
};

export const ComparisonFill: React.FC<ComparisonFillProps> = ({
  cx,
  cy,
  leftAttributes,
  rightAttributes,
  theme,
  polygonMode,
  fillDuration,
  radarScale = 1,
}) => {
  const MAX_RADIUS = RADAR_MAX_RADIUS * radarScale;
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame,
    [0, fillDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.45, 0, 0.55, 1),
    },
  );

  const animatedValues = rightAttributes.map((attr, i) => {
    if (polygonMode === "expand") {
      return attr.value * progress;
    }
    // extend: interpolate from left values to right values
    const leftVal = leftAttributes[i].value;
    return leftVal + (attr.value - leftVal) * progress;
  });
  const points = getRadarPolygonPoints(animatedValues, MAX_RADIUS, cx, cy);

  return (
    <polygon
      points={points}
      fill={theme.gridFillColor}
      stroke={theme.gridStrokeColor}
      strokeWidth={2.5}
      strokeLinejoin="round"
    />
  );
};
