import React from "react";
import { getGridRingPoints, getOctagonPoint } from "../../lib/math";
import { RADAR_MAX_RADIUS } from "../../../types/constants";

type RadarGridProps = {
  cx: number;
  cy: number;
  gridRingCount: number;
  gridColor: string;
  gridStrokeWidth: number;
  radarScale?: number;
};

export const RadarGrid: React.FC<RadarGridProps> = ({
  cx,
  cy,
  gridRingCount,
  gridColor,
  gridStrokeWidth,
  radarScale = 1,
}) => {
  const MAX_RADIUS = RADAR_MAX_RADIUS * radarScale;
  const axisWidth = Math.max(0.1, gridStrokeWidth * (2 / 3));
  const rings = Array.from({ length: gridRingCount }, (_, i) => {
    const level = (i + 1) / gridRingCount;
    return {
      points: getGridRingPoints(level, MAX_RADIUS, cx, cy),
      key: level,
    };
  });

  const axisLines = Array.from({ length: 8 }, (_, i) => {
    const end = getOctagonPoint(i, MAX_RADIUS, cx, cy);
    return { key: i, x2: end.x, y2: end.y };
  });

  return (
    <g>
      {rings.map((ring) => (
        <polygon
          key={ring.key}
          points={ring.points}
          fill="none"
          stroke={gridColor}
          strokeWidth={gridStrokeWidth}
        />
      ))}
      {axisLines.map((line) => (
        <line
          key={line.key}
          x1={cx}
          y1={cy}
          x2={line.x2}
          y2={line.y2}
          stroke={gridColor}
          strokeWidth={axisWidth}
        />
      ))}
    </g>
  );
};
