import React from "react";
import {
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { getRadarPolygonPoints } from "../../lib/math";
import type { AnimationConfig, RadarAttribute, RadarTheme } from "../../types/radar";
import { RADAR_MAX_RADIUS, computePhaseStarts } from "../../../types/constants";

type RadarFillProps = {
  cx: number;
  cy: number;
  attributes: RadarAttribute[];
  theme: RadarTheme;
  animation: AnimationConfig;
  radarScale?: number;
};

export const RadarFill: React.FC<RadarFillProps> = ({
  cx,
  cy,
  attributes,
  theme,
  animation,
  radarScale = 1,
}) => {
  const MAX_RADIUS = RADAR_MAX_RADIUS * radarScale;
  const frame = useCurrentFrame();

  const fillStart = computePhaseStarts(animation).fillStart;

  const progress = interpolate(
    frame,
    [fillStart, fillStart + animation.fillDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.45, 0, 0.55, 1),
    },
  );

  const animatedValues = attributes.map((attr) => attr.value * progress);
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
