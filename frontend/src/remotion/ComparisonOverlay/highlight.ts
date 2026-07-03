import { Easing, interpolate } from "remotion";
import type { OverlayPhases } from "../../types/constants";
import type { OverlayHighlightConfig } from "../../types/radar";

export type OverlaySide = "left" | "right";

export type HighlightState = {
  /** 自己被高亮的程度 ∈ [0,1]（加粗描边、光晕、填充增浓） */
  emphasis: number;
  /** 对方高亮时自己被压暗后的整体透明度 ∈ [dimOpacity,1] */
  opacity: number;
};

const CLAMP_EASE = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.inOut(Easing.ease),
} as const;

/** holdFrames 可为 0（p2==p3），interpolate 要求输入严格递增，逐项微推 */
function strictlyIncreasing(keys: number[]): number[] {
  const out = [...keys];
  for (let i = 1; i < out.length; i++) {
    if (out[i] <= out[i - 1]) out[i] = out[i - 1] + 0.001;
  }
  return out;
}

/**
 * 某一方在当前帧的高亮状态。
 * 编排：p1→p2 首方渐入高亮（次方渐暗），p3→p4 换边，p5→p6 双方恢复正常。
 */
export function highlightStateAt(
  frame: number,
  side: OverlaySide,
  phases: OverlayPhases,
  overlay: OverlayHighlightConfig,
): HighlightState {
  const firstSide: OverlaySide =
    overlay.highlightOrder === "left-first" ? "left" : "right";
  const isFirst = side === firstSide;
  const { p1, p2, p3, p4, p5, p6 } = phases;
  const emphKeys = strictlyIncreasing(isFirst ? [p1, p2, p3, p4] : [p3, p4, p5, p6]);
  const dimKeys = strictlyIncreasing(isFirst ? [p3, p4, p5, p6] : [p1, p2, p3, p4]);
  const emphasis = interpolate(frame, emphKeys, [0, 1, 1, 0], CLAMP_EASE);
  const dim = interpolate(frame, dimKeys, [0, 1, 1, 0], CLAMP_EASE);
  return { emphasis, opacity: 1 - dim * (1 - overlay.dimOpacity) };
}

/** 某方强弱箭头的可见度：自己高亮时出现；双方恢复正常（p5→p6）后常驻 */
export function arrowVisibilityAt(
  frame: number,
  side: OverlaySide,
  phases: OverlayPhases,
  overlay: OverlayHighlightConfig,
): number {
  const { emphasis } = highlightStateAt(frame, side, phases, overlay);
  const restored = interpolate(frame, [phases.p5, phases.p6], [0, 1], CLAMP_EASE);
  return Math.max(emphasis, restored);
}

/** 由 opacity 反推压暗进度 dimT ∈ [0,1]（dimOpacity=1 时永不压暗，取 0） */
export function dimProgress(opacity: number, dimOpacity: number): number {
  if (dimOpacity >= 1) return 0;
  return (1 - opacity) / (1 - dimOpacity);
}

/**
 * 角色名/slug 等文本元素的压暗重映射：多边形压到 dimOpacity 时，
 * 文本只压到 targetDim（留得更亮，保证可读）。
 */
export function remapDim(
  opacity: number,
  dimOpacity: number,
  targetDim: number,
): number {
  return 1 - dimProgress(opacity, dimOpacity) * (1 - targetDim);
}
