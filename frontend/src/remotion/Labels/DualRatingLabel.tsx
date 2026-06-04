import React from "react";
import {
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { getRadarLabelAnchor } from "../../lib/math";
import { calculateRating, getRatingColor } from "../../lib/rating";
import type { ComparisonArrowStyle, RadarVideoProps } from "../../types/radar";
import { RADAR_MAX_RADIUS } from "../../../types/constants";

const MAX_RADIUS = RADAR_MAX_RADIUS;
const DIFF_DOUBLE_THRESHOLD = 25;
const ARROW_CHAR = "➜";

function measureTextWidth(text: string, fontSize: number, fontFamily: string): number {
  if (typeof document === "undefined") return text.length * fontSize * 0.6;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * fontSize * 0.6;
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

type DiffBadgeProps = {
  cx: number;
  cy: number;
  size: number;
  isUp: boolean;
  isBig: boolean;
  color: string;
};

const DiffBadge: React.FC<DiffBadgeProps> = ({ cx, cy, size, isUp, isBig, color }) => {
  const halfW = size * 0.5;
  const halfH = size * 0.55;
  const triangle = (centerX: number) => {
    const tipY = isUp ? cy - halfH : cy + halfH;
    const baseY = isUp ? cy + halfH : cy - halfH;
    return `M ${centerX - halfW} ${baseY} L ${centerX + halfW} ${baseY} L ${centerX} ${tipY} Z`;
  };
  const gap = size * 0.2;
  const sideOffset = (size + gap) / 2;

  return (
    <g>
      {isBig ? (
        <>
          <path d={triangle(cx - sideOffset)} fill={color} />
          <path d={triangle(cx + sideOffset)} fill={color} />
        </>
      ) : (
        <path d={triangle(cx)} fill={color} />
      )}
    </g>
  );
};

type DualRatingLabelProps = {
  cx: number;
  cy: number;
  left: RadarVideoProps;
  right: RadarVideoProps;
  appearFrame: number;
  slideFrames: number;
  fadeFrames: number;
  triangleScale?: number;
  arrowStyle: ComparisonArrowStyle;
  haloColor?: string;
};

export const DualRatingLabel: React.FC<DualRatingLabelProps> = ({
  cx,
  cy,
  left,
  right,
  appearFrame,
  slideFrames,
  fadeFrames,
  triangleScale = 1,
  arrowStyle,
  haloColor,
}) => {
  const frame = useCurrentFrame();
  const fontSize = left.font.ratingLabel;
  const fontFamily = left.font.ratingLabelFamily;
  const attributeLabelFontSize = left.font.attributeLabel;
  const enhanceColor = arrowStyle.diffEnhanceColor;
  const weakenColor = arrowStyle.diffWeakenColor;
  const arrowFontSize = arrowStyle.arrowFontSize;
  const arrowColor = arrowStyle.arrowColor;
  const arrowDx = arrowStyle.arrowOffsetX;
  const arrowDy = arrowStyle.arrowOffsetY;
  const diffDx = arrowStyle.diffOffsetX;
  const diffDy = arrowStyle.diffOffsetY;
  const haloStrokeWidth = haloColor ? Math.max(4, fontSize * 0.18) : 0;
  const arrowHaloStrokeWidth = haloColor ? Math.max(4, arrowFontSize * 0.18) : 0;
  const haloStroke = haloColor ?? "none";

  const slideEnd = appearFrame + Math.max(1, slideFrames);
  const fadeEnd = slideEnd + Math.max(1, fadeFrames);

  const slideT = interpolate(frame, [appearFrame, slideEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const suffixOpacity = interpolate(frame, [slideEnd, fadeEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const tspanGap = 6;
  const triangleSize = arrowStyle.diffFontSize * triangleScale;
  const badgeGap = 8;

  return (
    <>
      {left.attributes.map((attr, i) => {
        const leftAttr = attr;
        const rightAttr = right.attributes[i];
        const leftR = calculateRating(leftAttr.value);
        const rightR = calculateRating(rightAttr.value);
        const lColor = getRatingColor(leftR);
        const rColor = getRatingColor(rightR);
        const pos = getRadarLabelAnchor(
          i,
          cx,
          cy,
          MAX_RADIUS,
          attributeLabelFontSize,
          fontSize,
        );

        const x =
          pos.x + (leftAttr.labelOffsetX ?? 0) + left.layout.ratingLabelOffsetX;
        const y =
          pos.y +
          pos.yOffset +
          (leftAttr.labelOffsetY ?? 0) +
          left.layout.ratingLabelOffsetY;

        const diff = rightAttr.value - leftAttr.value;
        const hasBadge = diff !== 0;
        const isUp = diff > 0;
        const isBig = Math.abs(diff) > DIFF_DOUBLE_THRESHOLD;
        const badgeColor = isUp ? enhanceColor : weakenColor;

        const wL = measureTextWidth(leftR.full, fontSize, fontFamily);
        const wArrow = measureTextWidth(ARROW_CHAR, arrowFontSize, fontFamily);
        const wR = measureTextWidth(rightR.full, fontSize, fontFamily);
        const textWidth = wL + tspanGap + wArrow + tspanGap + wR;
        const badgeWidth = isBig ? triangleSize * 2 + triangleSize * 0.2 : triangleSize;
        const badgeCx = x + textWidth / 2 + badgeGap + badgeWidth / 2;

        // Slide the A-rating from its original center (x) to the position
        // it occupies inside the "SS ➜ B" string.
        const ssTargetCenterX = x - (textWidth - wL) / 2;
        const ssCenterX = x + (ssTargetCenterX - x) * slideT;

        // Suffix pieces (arrow + B rating) appear at their final centers.
        const arrowCenterX = x - textWidth / 2 + wL + tspanGap + wArrow / 2;
        const bCenterX = x + textWidth / 2 - wR / 2;

        return (
          <g key={i}>
            <text
              x={ssCenterX}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={lColor}
              fontSize={fontSize}
              fontWeight="bold"
              fontFamily={fontFamily}
              paintOrder="stroke"
              stroke={haloStroke}
              strokeWidth={haloStrokeWidth}
              strokeLinejoin="round"
            >
              {leftR.full}
            </text>
            <g opacity={suffixOpacity}>
              <text
                x={arrowCenterX + arrowDx}
                y={y + arrowDy}
                textAnchor="middle"
                dominantBaseline="central"
                fill={arrowColor}
                fontSize={arrowFontSize}
                fontWeight="bold"
                fontFamily={fontFamily}
                paintOrder="stroke"
                stroke={haloStroke}
                strokeWidth={arrowHaloStrokeWidth}
                strokeLinejoin="round"
              >
                {ARROW_CHAR}
              </text>
              <text
                x={bCenterX}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={rColor}
                fontSize={fontSize}
                fontWeight="bold"
                fontFamily={fontFamily}
                paintOrder="stroke"
                stroke={haloStroke}
                strokeWidth={haloStrokeWidth}
                strokeLinejoin="round"
              >
                {rightR.full}
              </text>
              {hasBadge && (
                <DiffBadge
                  cx={badgeCx + diffDx}
                  cy={y + fontSize * 0.1 + diffDy}
                  size={triangleSize}
                  isUp={isUp}
                  isBig={isBig}
                  color={badgeColor}
                />
              )}
            </g>
          </g>
        );
      })}
    </>
  );
};
