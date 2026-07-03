import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { getRadarLabelAnchor } from "../../lib/math";
import { calculateRating, getRatingColor } from "../../lib/rating";
import type {
  AnimationConfig,
  FontConfig,
  OverlayHighlightConfig,
  RadarAttribute,
  RadarTheme,
} from "../../types/radar";
import type { OverlayPhases, PhaseStarts } from "../../types/constants";
import { highlightStateAt } from "./highlight";

/** 属性名 / 评级行字号（预览审定稿定值，不随页 font 缩放） */
export const OVERLAY_ATTRIBUTE_FONT_SIZE = 40;
export const OVERLAY_RATING_FONT_SIZE = 28;
/** 单个标签淡入上浮时长 / 评级行相对属性名的延迟 */
const LABEL_FADE_FRAMES = 10;
const RATING_APPEAR_DELAY = 5;
/** 左右评级距分隔「/」中线的水平距离 */
const RATING_GAP = 10;

const APPEAR_EASING = Easing.bezier(0.16, 1, 0.3, 1);

type OverlayVertexLabelsProps = {
  /** 属性名取左页 attributes 的 label */
  leftAttributes: readonly RadarAttribute[];
  rightAttributes: readonly RadarAttribute[];
  /** 标签配色/描边光环底色取左页 theme */
  theme: RadarTheme;
  font: FontConfig;
  animation: AnimationConfig;
  phaseStarts: PhaseStarts;
  phases: OverlayPhases;
  overlay: OverlayHighlightConfig;
  cx: number;
  cy: number;
  maxRadius: number;
};

/**
 * 每个顶点的属性名 + 双方评级行「L / R」：配色按数值 tier 走
 * （getRatingColor，与系统一致），归属靠「/」左右位置 + 高亮压暗联动区分；
 * 随 labelStagger 逐个淡入上浮。
 */
export const OverlayVertexLabels: React.FC<OverlayVertexLabelsProps> = ({
  leftAttributes,
  rightAttributes,
  theme,
  font,
  animation,
  phaseStarts,
  phases,
  overlay,
  cx,
  cy,
  maxRadius,
}) => {
  const frame = useCurrentFrame();
  const stateL = highlightStateAt(frame, "left", phases, overlay);
  const stateR = highlightStateAt(frame, "right", phases, overlay);
  const haloWidth = (size: number) => Math.max(4, size * 0.18);

  return (
    <g>
      {leftAttributes.map((attr, i) => {
        const anchor = getRadarLabelAnchor(
          i,
          cx,
          cy,
          maxRadius,
          OVERLAY_ATTRIBUTE_FONT_SIZE,
          OVERLAY_RATING_FONT_SIZE,
        );

        const attrAppear = phaseStarts.labelStart + i * animation.labelStagger;
        const fade = (from: number) => ({
          opacity: interpolate(frame, [from, from + LABEL_FADE_FRAMES], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: APPEAR_EASING,
          }),
          rise: interpolate(frame, [from, from + LABEL_FADE_FRAMES], [10, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: APPEAR_EASING,
          }),
        });
        const attrAnim = fade(attrAppear);
        const ratingAnim = fade(attrAppear + RATING_APPEAR_DELAY);

        const leftRating = calculateRating(attr.value);
        const rightRating = calculateRating(rightAttributes[i].value);

        const ratingProps = {
          y: anchor.y + anchor.yOffset + ratingAnim.rise,
          dominantBaseline: "central",
          fontSize: OVERLAY_RATING_FONT_SIZE,
          fontWeight: "bold",
          fontFamily: font.ratingLabelFamily,
          paintOrder: "stroke",
          stroke: theme.backgroundColor,
          strokeWidth: haloWidth(OVERLAY_RATING_FONT_SIZE),
          strokeLinejoin: "round",
        } as const;

        return (
          <g key={i}>
            <text
              x={anchor.x}
              y={anchor.y + attrAnim.rise}
              textAnchor="middle"
              dominantBaseline="central"
              fill={theme.labelColor}
              fontSize={OVERLAY_ATTRIBUTE_FONT_SIZE}
              fontWeight="bold"
              fontFamily={font.attributeLabelFamily}
              opacity={attrAnim.opacity}
              paintOrder="stroke"
              stroke={theme.backgroundColor}
              strokeWidth={haloWidth(OVERLAY_ATTRIBUTE_FONT_SIZE)}
              strokeLinejoin="round"
            >
              {attr.label}
            </text>
            <text
              {...ratingProps}
              x={anchor.x - RATING_GAP}
              textAnchor="end"
              fill={getRatingColor(leftRating)}
              opacity={ratingAnim.opacity * stateL.opacity}
            >
              {leftRating.full}
            </text>
            <text
              {...ratingProps}
              x={anchor.x}
              textAnchor="middle"
              fill="rgba(148,163,184,0.6)"
              opacity={ratingAnim.opacity}
            >
              /
            </text>
            <text
              {...ratingProps}
              x={anchor.x + RATING_GAP}
              textAnchor="start"
              fill={getRatingColor(rightRating)}
              opacity={ratingAnim.opacity * stateR.opacity}
            >
              {rightRating.full}
            </text>
          </g>
        );
      })}
    </g>
  );
};
