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

export const BackgroundMediaSchema = z.object({
  src: z.string().default(""),
  opacity: z.number().min(0).max(1).default(1),
  blur: z.number().min(0).max(50).default(0),
  scale: z.enum(["cover", "contain", "fill"]).default("cover"),
  position: z.enum(["center", "top", "bottom", "left", "right"]).default("center"),
  videoOptions: z
    .object({
      loop: z.boolean().default(true),
      muted: z.boolean().default(true),
      playbackRate: z.number().min(0.25).max(4).default(1),
      startFrom: z.number().min(0).default(0), // 毫秒；渲染时按 fps 换算为帧
    })
    .default({ loop: true, muted: true, playbackRate: 1, startFrom: 0 }),
});

export const BackgroundSchema = z
  .object({
    type: z.enum(["gradient", "image", "video"]).default("gradient"),
    media: BackgroundMediaSchema.optional(),
  })
  .default({ type: "gradient" });

export type BackgroundConfig = z.infer<typeof BackgroundSchema>;
export type BackgroundMediaConfig = z.infer<typeof BackgroundMediaSchema>;

export const defaultBackground: BackgroundConfig = { type: "gradient" };

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
  background: BackgroundSchema,
});

export type RadarVideoProps = z.infer<typeof RadarVideoSchema>;

/** 叠加高亮（overlay）布局的编排参数，默认值 = issue #17 预览审定稿 */
export const OverlayHighlightSchema = z.object({
  /** 先高亮哪一方 */
  highlightOrder: z.enum(["left-first", "right-first"]).default("left-first"),
  /** 双方绘制完成（顶点弹完）后到首次高亮的等待帧数 */
  delayAfterFill: z.number().min(0).max(120).default(18),
  /** 高亮切换的渐变时长 */
  transitionFrames: z.number().min(1).max(60).default(14),
  /** 每一方高亮的停留帧数 */
  holdFrames: z.number().min(0).max(240).default(42),
  /** 双方恢复正常后的尾部停留帧数 */
  holdTailFrames: z.number().min(0).max(600).default(70),
  /** 被压暗一方的整体透明度 */
  dimOpacity: z.number().min(0).max(1).default(0.15),
  /** 高亮方 drop-shadow 光晕半径（px） */
  glowRadius: z.number().min(0).max(60).default(16),
  /** 强弱三角尺寸（px） */
  arrowSize: z.number().min(8).max(80).default(24),
  /** 箭头距评级行中线的水平距离（左方在左、右方在右） */
  arrowSideOffset: z.number().min(0).max(300).default(92),
  /** 箭头垂直微调 */
  arrowOffsetY: z.number().min(-200).max(200).default(0),
  /** 两侧角色名距画面中线的水平距离 */
  nameSideOffset: z.number().min(100).max(960).default(665),
  /** 剪影常态透明度（叠加图中调低避免压过雷达图） */
  silhouetteBaseOpacity: z.number().min(0).max(1).default(0.4),
  /** 剪影高亮透明度 */
  silhouetteEmphasisOpacity: z.number().min(0).max(1).default(0.85),
  /** 剪影被压暗透明度 */
  silhouetteDimOpacity: z.number().min(0).max(1).default(0.1),
});

export type OverlayHighlightConfig = z.infer<typeof OverlayHighlightSchema>;

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
  // 运行时旧配置（useAutoSave 不过 schema）可能缺以下两个字段，故声明为可选，
  // 读取处一律 `?? "transition"` / `?? defaultOverlayHighlightConfig` 兜底
  layout?: "transition" | "overlay";
  overlay?: OverlayHighlightConfig;
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
  layout: z.enum(["transition", "overlay"]).default("transition"),
  // 整块 .default() 让旧 localStorage 配置在 safeParse 时整体回填。
  // 字面量不能换成 constants.defaultOverlayHighlightConfig（constants 已 import
  // 本文件，会循环依赖），与 constants 的一致性由 radar.test.ts 深比较守卫。
  overlay: OverlayHighlightSchema.default({
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
  }),
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
