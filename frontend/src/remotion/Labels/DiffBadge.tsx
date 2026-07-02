import React from "react";

/** |差值| 超过该阈值时显示双三角 */
export const DIFF_DOUBLE_THRESHOLD = 25;

type DiffBadgeProps = {
  cx: number;
  cy: number;
  size: number;
  isUp: boolean;
  isBig: boolean;
  color: string;
};

/**
 * 强弱三角标记：▲（更强）/ ▼（更弱），isBig 时双三角。
 * 由 DualRatingLabel 抽出，供换场式对比与叠加高亮（StrengthArrows）共用。
 */
export const DiffBadge: React.FC<DiffBadgeProps> = ({ cx, cy, size, isUp, isBig, color }) => {
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
