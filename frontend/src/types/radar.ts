import { z } from "zod";

export type LayoutConfig = {
  radarCX: number;
  radarCY: number;
  gridRingCount: number;
  gridStrokeWidth: number;
  silhouetteOffsetX: number;
  silhouetteOffsetY: number;
  silhouetteScale: number;
  characterNameOffsetX: number;
  characterNameOffsetY: number;
  syncSilhouetteOffset: boolean;
  attributeLabelOffsetX: number;
  attributeLabelOffsetY: number;
  ratingLabelOffsetX: number;
  ratingLabelOffsetY: number;
  radarScale: number;
};

export type RadarAttribute = {
  label: string;
  shortLabel: string;
  value: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
};

export type RadarTheme = {
  backgroundColor: string;
  gridColor: string;
  gridFillColor: string;
  gridStrokeColor: string;
  dotColor: string;
  highValueDotColor: string;
  labelColor: string;
  valueColor: string;
  glowColor: string;
  enhanceArrowColor: string;
  weakenArrowColor: string;
  silhouetteOpacity: number;
  vignetteEnabled: boolean;
  vignetteBrightness: number;
  vignetteCenterX: number;
  vignetteCenterY: number;
  vignetteInnerStop: number;
  vignetteOuterStop: number;
};

export type PopupStyle = "spring" | "bounce" | "fadeScale" | "slideIn";
export type GlowStyle = "pulse" | "ring" | "ripple" | "sparkle";

export type AnimationConfig = {
  fillDuration: number;
  silhouetteDelay: number;
  labelStagger: number;
  highValueThreshold: number;
  highValueSpringDamping: number;
  holdDuration: number;
  labelStartOffset: number;
  fillStartOffset: number;
  effectsStartOffset: number;
  holdStartOffset: number;
  valuePopupEnabled: boolean;
  valuePopupStyle: PopupStyle;
  highValueGlowEnabled: boolean;
  highValueGlowStyle: GlowStyle;
  silhouetteFadeInDuration: number;
  nameFadeInDuration: number;
  nameAppearRatio: number;
};

export type FontConfig = {
  characterName: number;
  characterNameFamily: string;
  attributeLabel: number;
  attributeLabelFamily: string;
  ratingLabel: number;
  ratingLabelFamily: string;
  valuePopup: number;
  valuePopupFamily: string;
};

const AttributeSchema = z.object({
  label: z.string(),
  shortLabel: z.string(),
  value: z.number().min(0).max(200),
  labelOffsetX: z.number().min(-200).max(200).optional().default(0),
  labelOffsetY: z.number().min(-200).max(200).optional().default(0),
});

const LayoutSchema = z.object({
  radarCX: z.number().min(200).max(1800),
  radarCY: z.number().min(100).max(900),
  gridRingCount: z.number().min(1).max(10),
  gridStrokeWidth: z.number().min(0.2).max(8).default(1.5),
  silhouetteOffsetX: z.number().min(-500).max(500),
  silhouetteOffsetY: z.number().min(-500).max(500),
  silhouetteScale: z.number().min(0.2).max(3).default(1),
  characterNameOffsetX: z.number().min(-500).max(500),
  characterNameOffsetY: z.number().min(-500).max(500),
  syncSilhouetteOffset: z.boolean(),
  attributeLabelOffsetX: z.number().min(-500).max(500).default(0),
  attributeLabelOffsetY: z.number().min(-500).max(500).default(0),
  ratingLabelOffsetX: z.number().min(-500).max(500).default(0),
  ratingLabelOffsetY: z.number().min(-500).max(500).default(0),
  radarScale: z.number().min(0.3).max(3).default(1),
});

export const SlugSchema = z.object({
  text: z.string().default(""),
  fontFamily: z.string().default(""),
  fontSize: z.number().min(8).max(200).default(36),
  offsetX: z.number().min(-1000).max(1000).default(0),
  offsetY: z.number().min(-1000).max(1000).default(0),
  color: z.string().default("#e2e8f0"),
  fadeOffsetFrames: z.number().min(-120).max(120).default(10),
});

export type SlugConfig = z.infer<typeof SlugSchema>;

export const defaultSlug: SlugConfig = {
  text: "",
  fontFamily: "",
  fontSize: 36,
  offsetX: 0,
  offsetY: 0,
  color: "#e2e8f0",
  fadeOffsetFrames: 10,
};

export const RadarVideoSchema = z.object({
  characterName: z.string(),
  characterNameAlign: z.enum(["left", "center", "right"]).default("center"),
  silhouetteSrc: z.string(),
  slug: SlugSchema.default(defaultSlug),
  attributes: z.tuple([
    AttributeSchema, AttributeSchema, AttributeSchema, AttributeSchema,
    AttributeSchema, AttributeSchema, AttributeSchema, AttributeSchema,
  ]),
  theme: z.object({
    backgroundColor: z.string(),
    gridColor: z.string(),
    gridFillColor: z.string(),
    gridStrokeColor: z.string(),
    dotColor: z.string(),
    highValueDotColor: z.string(),
    labelColor: z.string(),
    valueColor: z.string(),
    glowColor: z.string(),
    enhanceArrowColor: z.string().default("#ef4444"),
    weakenArrowColor: z.string().default("#22c55e"),
    silhouetteOpacity: z.number().min(0).max(1),
    vignetteEnabled: z.boolean(),
    vignetteBrightness: z.number().min(-100).max(0),
    vignetteCenterX: z.number().min(0).max(100),
    vignetteCenterY: z.number().min(0).max(100),
    vignetteInnerStop: z.number().min(0).max(90),
    vignetteOuterStop: z.number().min(10).max(100),
  }),
  animation: z.object({
    fillDuration: z.number().min(10).max(120),
    silhouetteDelay: z.number().min(0).max(60),
    labelStagger: z.number().min(0).max(15),
    highValueThreshold: z.number().min(50).max(200),
    highValueSpringDamping: z.number().min(2).max(30),
    holdDuration: z.number().min(0).max(600),
    labelStartOffset: z.number().min(-60).max(60).default(0),
    fillStartOffset: z.number().min(-60).max(60).default(-10),
    effectsStartOffset: z.number().min(-120).max(60).default(-9),
    holdStartOffset: z.number().min(-60).max(60).default(0),
    valuePopupEnabled: z.boolean(),
    valuePopupStyle: z.enum(["spring", "bounce", "fadeScale", "slideIn"]),
    highValueGlowEnabled: z.boolean(),
    highValueGlowStyle: z.enum(["pulse", "ring", "ripple", "sparkle"]),
    silhouetteFadeInDuration: z.number().min(5).max(90).default(30),
    nameFadeInDuration: z.number().min(5).max(60).default(20),
    nameAppearRatio: z.number().min(0).max(1).default(0.7),
  }),
  font: z.object({
    characterName: z.number().min(30).max(180),
    characterNameFamily: z.string().default("sans-serif"),
    attributeLabel: z.number().min(18).max(90),
    attributeLabelFamily: z.string().default("sans-serif"),
    ratingLabel: z.number().min(15).max(75),
    ratingLabelFamily: z.string().default("sans-serif"),
    valuePopup: z.number().min(18).max(75),
    valuePopupFamily: z.string().default("sans-serif"),
  }),
  layout: LayoutSchema,
  overrideIgnored: z.record(z.string(), z.boolean()).default({}),
});

export type RadarVideoProps = z.infer<typeof RadarVideoSchema>;

export type ComparisonPairConfig = {
  firstPageIndex: number;
  secondPageIndex: number;
  delayFrames: number;
  polygonMode: "expand" | "extend";
  showLegend: boolean;
  silhouetteSwapOffsetX: number;
  silhouetteSwapOffsetY: number;
  silhouetteFadeOutOpacity: number;
  legendFontSize: number;
  legendOffsetX: number;
  legendOffsetY: number;
  legendFontFamily: string;
  swapDurationFrames: number;
  diffTriangleScale: number;
  legendDotRadius: number;
  dualRatingSlideFrames: number;
  dualRatingFadeFrames: number;
};

export const ComparisonPairSchema = z.object({
  firstPageIndex: z.number(),
  secondPageIndex: z.number(),
  delayFrames: z.number().min(-120).max(120).default(15),
  polygonMode: z.enum(["expand", "extend"]).default("expand"),
  showLegend: z.boolean().default(true),
  silhouetteSwapOffsetX: z.number().min(-500).max(500).default(80),
  silhouetteSwapOffsetY: z.number().min(-500).max(500).default(0),
  silhouetteFadeOutOpacity: z.number().min(0).max(1).default(0.3),
  legendFontSize: z.number().min(12).max(60).default(22),
  legendOffsetX: z.number().min(-500).max(500).default(0),
  legendOffsetY: z.number().min(-500).max(500).default(0),
  legendFontFamily: z.string().default(""),
  swapDurationFrames: z.number().min(1).max(120).default(15),
  diffTriangleScale: z.number().min(0.3).max(3).default(1),
  legendDotRadius: z.number().min(2).max(30).default(6),
  dualRatingSlideFrames: z.number().min(1).max(60).default(10),
  dualRatingFadeFrames: z.number().min(1).max(60).default(10),
});

export const ComparisonArrowStyleSchema = z.object({
  arrowFontSize: z.number().min(8).max(200).default(45),
  arrowColor: z.string().default("#94a3b8"),
  arrowOffsetX: z.number().min(-200).max(200).default(0),
  arrowOffsetY: z.number().min(-200).max(200).default(0),
  diffFontSize: z.number().min(8).max(200).default(45),
  diffEnhanceColor: z.string().default("#ef4444"),
  diffWeakenColor: z.string().default("#22c55e"),
  diffOffsetX: z.number().min(-200).max(200).default(0),
  diffOffsetY: z.number().min(-200).max(200).default(0),
});

export type ComparisonArrowStyle = z.infer<typeof ComparisonArrowStyleSchema>;

export const GlobalOverrideSchema = z.object({
  enabled: z.record(z.string(), z.boolean()).default({}),
  values: RadarVideoSchema,
});

export type GlobalOverrideConfig = z.infer<typeof GlobalOverrideSchema>;

export const MultiPageSchema = z.object({
  pages: z.array(RadarVideoSchema),
  musicUrl: z.string(),
  comparisons: z.array(ComparisonPairSchema).default([]),
  globalOverride: GlobalOverrideSchema.optional(),
  comparisonArrowStyle: ComparisonArrowStyleSchema.default({
    arrowFontSize: 45,
    arrowColor: "#94a3b8",
    arrowOffsetX: 0,
    arrowOffsetY: 0,
    diffFontSize: 45,
    diffEnhanceColor: "#ef4444",
    diffWeakenColor: "#22c55e",
    diffOffsetX: 0,
    diffOffsetY: 0,
  }),
});

export type MultiPageConfig = z.infer<typeof MultiPageSchema>;

export type ComparisonOverlayConfig = {
  secondary: RadarVideoProps;
  config: ComparisonPairConfig;
  arrowStyle: ComparisonArrowStyle;
};
