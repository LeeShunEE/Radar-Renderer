/**
 * editor 组件测试共享 fixture：构造完整合法的 RadarVideoConfig / MultiPageConfig。
 *
 * editor 组件不运行 schema 校验（只读字段 + 触发 onChange），故这里只需形状正确。
 * 各 editor 测试从中提取所需切片（font/layout/theme/animation/...）。
 *
 * 文件名无 .test 后缀，不会被 vitest 当作测试；位于 tests/ 不计入覆盖率。
 */
import type {
  MultiPageConfig,
  RadarVideoProps,
  RadarAttribute,
  RadarTheme,
  AnimationConfig,
  FontConfig,
  LayoutConfig,
} from "@/types/radar";

export const baseAttribute = (i: number): RadarAttribute => ({
  label: `属性${i + 1}`,
  shortLabel: `P${i + 1}`,
  value: 60 + i * 5,
  labelOffsetX: 0,
  labelOffsetY: 0,
});

export const baseTheme: RadarTheme = {
  backgroundColor: "#0f172a",
  gridColor: "#1e293b",
  gridFillColor: "#3b82f6",
  gridStrokeColor: "#60a5fa",
  dotColor: "#93c5fd",
  highValueDotColor: "#fbbf24",
  labelColor: "#e2e8f0",
  valueColor: "#f8fafc",
  glowColor: "#f59e0b",
  enhanceArrowColor: "#ef4444",
  weakenArrowColor: "#22c55e",
  silhouetteOpacity: 0.3,
  vignetteEnabled: false,
  vignetteBrightness: -30,
  vignetteCenterX: 50,
  vignetteCenterY: 50,
  vignetteInnerStop: 30,
  vignetteOuterStop: 90,
};

export const baseAnimation: AnimationConfig = {
  fillDuration: 60,
  silhouetteDelay: 0,
  labelStagger: 5,
  highValueThreshold: 120,
  highValueSpringDamping: 12,
  holdDuration: 60,
  labelStartOffset: 0,
  fillStartOffset: -10,
  effectsStartOffset: -9,
  holdStartOffset: 0,
  valuePopupEnabled: true,
  valuePopupStyle: "spring",
  highValueGlowEnabled: false,
  highValueGlowStyle: "pulse",
  silhouetteFadeInDuration: 30,
  nameFadeInDuration: 20,
  nameAppearRatio: 0.7,
};

export const baseFont: FontConfig = {
  characterName: 72,
  characterNameFamily: "sans-serif",
  attributeLabel: 28,
  attributeLabelFamily: "sans-serif",
  ratingLabel: 24,
  ratingLabelFamily: "sans-serif",
  valuePopup: 32,
  valuePopupFamily: "sans-serif",
};

export const baseLayout: LayoutConfig = {
  radarCX: 960,
  radarCY: 540,
  gridRingCount: 5,
  gridStrokeWidth: 1.5,
  silhouetteOffsetX: 0,
  silhouetteOffsetY: 0,
  silhouetteScale: 1,
  characterNameOffsetX: 0,
  characterNameOffsetY: 0,
  syncSilhouetteOffset: true,
  attributeLabelOffsetX: 0,
  attributeLabelOffsetY: 0,
  ratingLabelOffsetX: 0,
  ratingLabelOffsetY: 0,
  radarScale: 1,
};

export function makePage(overrides: Partial<RadarVideoProps> = {}): RadarVideoProps {
  return {
    characterName: "角色",
    characterNameAlign: "center",
    silhouetteSrc: "",
    slug: {
      text: "",
      fontFamily: "sans-serif",
      fontSize: 16,
      offsetX: 0,
      offsetY: 0,
      color: "#ffffff",
      fadeOffsetFrames: 10,
    },
    attributes: [0, 1, 2, 3, 4, 5, 6, 7].map(baseAttribute) as RadarVideoProps["attributes"],
    theme: { ...baseTheme },
    animation: { ...baseAnimation },
    font: { ...baseFont },
    layout: { ...baseLayout },
    overrideIgnored: {},
    ...overrides,
  };
}

export function makeMultiPageConfig(
  pageCount = 2,
  pageOverrides: Partial<RadarVideoProps> = {},
): MultiPageConfig {
  const pages = Array.from({ length: pageCount }, (_, i) =>
    makePage({ characterName: `角色${i + 1}`, ...pageOverrides }),
  );
  return {
    pages,
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
}
