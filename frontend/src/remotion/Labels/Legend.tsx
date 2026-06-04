import React from "react";
import {
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import type { RadarVideoProps } from "../../types/radar";

function measureTextWidth(text: string, fontSize: number, fontFamily: string): number {
  if (typeof document === "undefined") return text.length * fontSize * 0.6;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * fontSize * 0.6;
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

type LegendProps = {
  left: RadarVideoProps;
  right: RadarVideoProps;
  offsetX?: number;
  offsetY?: number;
  fontSize?: number;
  fontFamily?: string;
  dotRadius?: number;
  lineHeight?: number;
  gap?: number;
};

export const Legend: React.FC<LegendProps> = ({
  left,
  right,
  offsetX = 0,
  offsetY = 0,
  fontSize = 33,
  fontFamily = "",
  dotRadius = 6,
  lineHeight,
  gap = 14,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const textRightX = 1780 + offsetX;
  const baseY = 60 + offsetY;
  const rowHeight = lineHeight ?? Math.round(fontSize * 1.45);

  const leftFontFamily = fontFamily || left.font.characterNameFamily;
  const rightFontFamily = fontFamily || right.font.characterNameFamily;

  const leftTextWidth = measureTextWidth(left.characterName, fontSize, leftFontFamily);
  const rightTextWidth = measureTextWidth(right.characterName, fontSize, rightFontFamily);
  const maxTextWidth = Math.max(leftTextWidth, rightTextWidth);
  const textLeftX = textRightX - maxTextWidth;

  return (
    <g opacity={opacity}>
      <circle
        cx={textLeftX - dotRadius * 2 - gap}
        cy={baseY}
        r={dotRadius}
        fill={left.theme.gridStrokeColor}
      />
      <text
        x={textLeftX}
        y={baseY}
        textAnchor="start"
        dominantBaseline="central"
        fill={left.theme.labelColor}
        fontSize={fontSize}
        fontWeight="bold"
        fontFamily={leftFontFamily}
      >
        {left.characterName}
      </text>

      <circle
        cx={textLeftX - dotRadius * 2 - gap}
        cy={baseY + rowHeight}
        r={dotRadius}
        fill={right.theme.gridStrokeColor}
      />
      <text
        x={textLeftX}
        y={baseY + rowHeight}
        textAnchor="start"
        dominantBaseline="central"
        fill={right.theme.labelColor}
        fontSize={fontSize}
        fontWeight="bold"
        fontFamily={rightFontFamily}
      >
        {right.characterName}
      </text>
    </g>
  );
};
