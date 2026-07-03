import React from "react";
import { useCurrentFrame } from "remotion";
import { getRadarLabelAnchor } from "../../lib/math";
import type {
  ComparisonArrowStyle,
  OverlayHighlightConfig,
  RadarAttribute,
} from "../../types/radar";
import type { OverlayPhases } from "../../types/constants";
import { DiffBadge, DIFF_DOUBLE_THRESHOLD } from "../Labels/DiffBadge";
import { arrowVisibilityAt, type OverlaySide } from "./highlight";
import {
  OVERLAY_ATTRIBUTE_FONT_SIZE,
  OVERLAY_RATING_FONT_SIZE,
} from "./OverlayVertexLabels";

type StrengthArrowsProps = {
  leftAttributes: readonly RadarAttribute[];
  rightAttributes: readonly RadarAttribute[];
  phases: OverlayPhases;
  overlay: OverlayHighlightConfig;
  /** 增强/减弱色复用全局对比箭头样式的 diffEnhanceColor/diffWeakenColor */
  arrowStyle: ComparisonArrowStyle;
  cx: number;
  cy: number;
  maxRadius: number;
};

/**
 * 顶点强弱三角箭头（与 DualRatingLabel 的 DiffBadge 同构）：
 * ▲更强 / ▼更弱，|差值| > DIFF_DOUBLE_THRESHOLD 时双三角。
 * 某方高亮时己方箭头弹出；双方恢复正常（p5→p6）后两方箭头常驻评级行两侧
 * （左方在左、右方在右），不渲染数值差。
 */
export const StrengthArrows: React.FC<StrengthArrowsProps> = ({
  leftAttributes,
  rightAttributes,
  phases,
  overlay,
  arrowStyle,
  cx,
  cy,
  maxRadius,
}) => {
  const frame = useCurrentFrame();
  const sides: Array<{
    own: readonly RadarAttribute[];
    other: readonly RadarAttribute[];
    side: OverlaySide;
  }> = [
    { own: leftAttributes, other: rightAttributes, side: "left" },
    { own: rightAttributes, other: leftAttributes, side: "right" },
  ];

  return (
    <g>
      {sides.map(({ own, other, side }) => {
        const visibility = arrowVisibilityAt(frame, side, phases, overlay);
        if (visibility < 0.01) return null;
        return own.map((attr, i) => {
          const diff = attr.value - other[i].value;
          if (diff === 0) return null;
          const anchor = getRadarLabelAnchor(
            i,
            cx,
            cy,
            maxRadius,
            OVERLAY_ATTRIBUTE_FONT_SIZE,
            OVERLAY_RATING_FONT_SIZE,
          );
          const x =
            anchor.x +
            (side === "left" ? -overlay.arrowSideOffset : overlay.arrowSideOffset);
          const y = anchor.y + anchor.yOffset + overlay.arrowOffsetY;
          return (
            <g
              key={`${side}-${i}`}
              opacity={visibility}
              transform={`translate(${x} ${y}) scale(${visibility}) translate(${-x} ${-y})`}
            >
              <DiffBadge
                cx={x}
                cy={y}
                size={overlay.arrowSize}
                isUp={diff > 0}
                isBig={Math.abs(diff) > DIFF_DOUBLE_THRESHOLD}
                color={
                  diff > 0 ? arrowStyle.diffEnhanceColor : arrowStyle.diffWeakenColor
                }
              />
            </g>
          );
        });
      })}
    </g>
  );
};
