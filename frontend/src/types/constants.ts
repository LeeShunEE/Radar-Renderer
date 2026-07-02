import { z } from "zod";
import { RadarVideoSchema, MultiPageSchema, ComparisonPairSchema, defaultBackground } from "./radar";
import type { ComparisonPairConfig, OverlayHighlightConfig } from "./radar";

export const COMP_NAME = "RadarChartVideo";
export const VIDEO_FPS = 30;
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;

// Radar chart position (right half)
export const RADAR_CX = 1380;
export const RADAR_CY = 540;
export const RADAR_MAX_RADIUS = 340;

// Left area center
export const LEFT_CENTER_X = 480;

export const CompositionProps = RadarVideoSchema;

export const MULTI_COMP_NAME = "MultiPageRadarVideo";

export const MultiPageCompositionProps = MultiPageSchema;

export const defaultRadarProps: z.infer<typeof RadarVideoSchema> = {
  characterName: "Hero",
  characterNameAlign: "center",
  silhouetteSrc: "",
  slug: {
    text: "",
    fontFamily: "",
    fontSize: 36,
    offsetX: 0,
    offsetY: 0,
    color: "#e2e8f0",
    fadeOffsetFrames: 10,
  },
  attributes: [
    { label: "Strength", shortLabel: "STR", value: 85, labelOffsetX: 0, labelOffsetY: 0 },
    { label: "Agility", shortLabel: "AGI", value: 60, labelOffsetX: 0, labelOffsetY: 0 },
    { label: "Intelligence", shortLabel: "INT", value: 90, labelOffsetX: 0, labelOffsetY: 0 },
    { label: "Endurance", shortLabel: "END", value: 55, labelOffsetX: 0, labelOffsetY: 0 },
    { label: "Charisma", shortLabel: "CHA", value: 70, labelOffsetX: 0, labelOffsetY: 0 },
    { label: "Luck", shortLabel: "LCK", value: 80, labelOffsetX: 0, labelOffsetY: 0 },
    { label: "Defense", shortLabel: "DEF", value: 45, labelOffsetX: 0, labelOffsetY: 0 },
    { label: "Speed", shortLabel: "SPD", value: 65, labelOffsetX: 0, labelOffsetY: 0 },
  ],
  theme: {
    backgroundColor: "#0a0a1a",
    gridColor: "rgba(255,255,255,0.12)",
    gridFillColor: "rgba(99,102,241,0.25)",
    gridStrokeColor: "rgba(99,102,241,0.8)",
    dotColor: "#818cf8",
    highValueDotColor: "#f59e0b",
    labelColor: "#e2e8f0",
    valueColor: "#f8fafc",
    glowColor: "#f59e0b",
    enhanceArrowColor: "#ef4444",
    weakenArrowColor: "#22c55e",
    silhouetteOpacity: 1,
    vignetteEnabled: true,
    vignetteBrightness: -30,
    vignetteCenterX: 50,
    vignetteCenterY: 50,
    vignetteInnerStop: 0,
    vignetteOuterStop: 100,
  },
  animation: {
    fillDuration: 45,
    silhouetteDelay: 15,
    labelStagger: 3,
    highValueThreshold: 75,
    highValueSpringDamping: 12,
    holdDuration: 30,
    labelStartOffset: 0,
    fillStartOffset: -10,
    effectsStartOffset: -9,
    holdStartOffset: 0,
    valuePopupEnabled: true,
    valuePopupStyle: "spring",
    highValueGlowEnabled: true,
    highValueGlowStyle: "ring",
    silhouetteFadeInDuration: 30,
    nameFadeInDuration: 20,
    nameAppearRatio: 0.7,
  },
  font: {
    characterName: 126,
    characterNameFamily: "Noto Sans SC",
    attributeLabel: 63,
    attributeLabelFamily: "Noto Sans SC",
    ratingLabel: 45,
    ratingLabelFamily: "Noto Sans SC",
    valuePopup: 54,
    valuePopupFamily: "Noto Sans SC",
  },
  layout: {
    radarCX: 1380,
    radarCY: 540,
    gridRingCount: 4,
    gridStrokeWidth: 1.5,
    silhouetteOffsetX: 0,
    silhouetteOffsetY: 0,
    silhouetteScale: 1,
    characterNameOffsetX: 0,
    characterNameOffsetY: 0,
    syncSilhouetteOffset: false,
    attributeLabelOffsetX: 0,
    attributeLabelOffsetY: 0,
    ratingLabelOffsetX: 0,
    ratingLabelOffsetY: 0,
    radarScale: 1,
  },
  overrideIgnored: {},
  background: defaultBackground,
};

export const defaultMultiPageConfig: z.infer<typeof MultiPageSchema> = {
  globalOverride: { enabled: {}, values: defaultRadarProps },
  pages: [defaultRadarProps],
  musicUrl: "",
  comparisons: [],
  comparisonArrowStyle: {
    arrowFontSize: 45,
    arrowColor: "#94a3b8",
    arrowOffsetX: 0,
    arrowOffsetY: 0,
    diffFontSize: 45,
    diffEnhanceColor: "#ef4444",
    diffWeakenColor: "#22c55e",
    diffOffsetX: 0,
    diffOffsetY: 0,
  },
};

// 与 radar.ts 里 ComparisonPairSchema.overlay 的 .default() 字面量保持一致
// （radar.ts 不能 import 本文件，双份字面量由 radar.test.ts 深比较守卫）
export const defaultOverlayHighlightConfig: OverlayHighlightConfig = {
  highlightOrder: "left-first",
  delayAfterFill: 18,
  transitionFrames: 14,
  holdFrames: 42,
  holdTailFrames: 70,
  dimOpacity: 0.15,
  glowRadius: 16,
  arrowSize: 24,
  arrowSideOffset: 92,
  arrowOffsetY: 0,
  nameSideOffset: 665,
  silhouetteBaseOpacity: 0.4,
  silhouetteEmphasisOpacity: 0.85,
  silhouetteDimOpacity: 0.1,
};

export const defaultComparisonConfig: z.infer<typeof ComparisonPairSchema> = {
  firstPageIndex: 0,
  secondPageIndex: 1,
  delayFrames: 15,
  polygonMode: "expand",
  showLegend: true,
  silhouetteSwapOffsetX: 80,
  silhouetteSwapOffsetY: 0,
  silhouetteFadeOutOpacity: 0.3,
  legendFontSize: 22,
  legendOffsetX: 0,
  legendOffsetY: 0,
  legendFontFamily: "",
  swapDurationFrames: 15,
  diffTriangleScale: 1,
  legendDotRadius: 6,
  dualRatingSlideFrames: 10,
  dualRatingFadeFrames: 10,
  layout: "transition",
  overlay: defaultOverlayHighlightConfig,
};

export const LABEL_START_FRAME = 10;
export const EFFECTS_DURATION = 30;

export type PhaseStarts = {
  labelStart: number;
  labelEnd: number;
  fillStart: number;
  fillEnd: number;
  effectsStart: number;
  effectsEnd: number;
  holdStart: number;
  holdEnd: number;
};

export function computePhaseStarts(
  animation: z.infer<typeof RadarVideoSchema>["animation"],
): PhaseStarts {
  const labelStart = LABEL_START_FRAME + (animation.labelStartOffset ?? 0);
  const labelEnd = labelStart + (animation.labelStagger ?? 0) * 8;
  const fillStart = labelEnd + (animation.fillStartOffset ?? -10);
  const fillEnd = fillStart + (animation.fillDuration ?? 0);
  const effectsStart = fillEnd + (animation.effectsStartOffset ?? -9);
  const effectsEnd = effectsStart + EFFECTS_DURATION;
  const holdStart = effectsEnd + (animation.holdStartOffset ?? 0);
  const holdEnd = holdStart + (animation.holdDuration ?? 0);
  return { labelStart, labelEnd, fillStart, fillEnd, effectsStart, effectsEnd, holdStart, holdEnd };
}

export function calculateDuration(
  animation: z.infer<typeof RadarVideoSchema>["animation"],
): number {
  const p = computePhaseStarts(animation);
  const end = Math.max(p.labelEnd, p.fillEnd, p.effectsEnd, p.holdEnd);
  const start = Math.min(0, p.labelStart, p.fillStart, p.effectsStart, p.holdStart);
  return Math.max(1, end - start);
}

/** 顶点圆点从 fill 结束到全部弹出落定的帧数（overlay 高亮编排的起算点） */
export const OVERLAY_DOTS_SETTLE_FRAMES = 30;

export type OverlayPhases = {
  /** 顶点弹出全部落定 */
  dotsSettled: number;
  /** p1→p2 首方渐入高亮，p2→p3 停留，p3→p4 换边，p4→p5 停留，p5→p6 恢复常态 */
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  p5: number;
  p6: number;
  /** 含尾部停留与负偏移保护的总帧数 */
  total: number;
};

/**
 * overlay 布局的高亮编排关键帧：双方八边形共用同一节奏、同时绘制，
 * animation 取对比的**左页**（右页 animation 时序按设计忽略）。
 * 同时供 calculateComparisonDuration 与 ComparisonOverlay 组件使用。
 */
export function computeOverlayPhases(
  animation: z.infer<typeof RadarVideoSchema>["animation"],
  overlay: OverlayHighlightConfig,
): OverlayPhases {
  const p = computePhaseStarts(animation);
  const dotsSettled = p.fillEnd + OVERLAY_DOTS_SETTLE_FRAMES;
  const p1 = dotsSettled + overlay.delayAfterFill;
  const p2 = p1 + overlay.transitionFrames;
  const p3 = p2 + overlay.holdFrames;
  const p4 = p3 + overlay.transitionFrames;
  const p5 = p4 + overlay.holdFrames;
  const p6 = p5 + overlay.transitionFrames;
  // 负偏移保护：fillStartOffset（默认 -10）等可使阶段起点 < 0，与
  // calculateDuration 同样把负向前导并入总长
  const negativeLead = Math.min(0, p.labelStart, p.fillStart);
  const total = Math.max(1, p6 + overlay.holdTailFrames - negativeLead);
  return { dotsSettled, p1, p2, p3, p4, p5, p6, total };
}

export function calculateComparisonDuration(
  left: z.infer<typeof RadarVideoSchema>,
  right: z.infer<typeof RadarVideoSchema>,
  comparisonConfig: ComparisonPairConfig,
): number {
  // transition/overlay 的时长分支只在此处做，6 个调用点（Root / MultiPageVideo /
  // PreviewPanel / ExportPanel / LocalRenderStage / GlobalConfigEditor）自动生效
  if ((comparisonConfig.layout ?? "transition") === "overlay") {
    const overlay = comparisonConfig.overlay ?? defaultOverlayHighlightConfig;
    return computeOverlayPhases(left.animation, overlay).total;
  }
  const leftEnd = calculateDuration(left.animation);
  const rightStart = leftEnd + comparisonConfig.delayFrames;
  const rightLen = calculateDuration(right.animation);
  return Math.max(leftEnd, rightStart + rightLen);
}
