import { describe, it, expect } from "vitest";
import {
  RadarVideoSchema,
  BackgroundSchema,
  ComparisonPairSchema,
  MultiPageSchema,
  OverlayHighlightSchema,
  defaultBackground,
} from "@/types/radar";
import {
  defaultComparisonConfig,
  defaultOverlayHighlightConfig,
} from "@/types/constants";
import { makePage } from "../components/editor/_fixtures";

describe("BackgroundSchema", () => {
  it("默认回落 gradient", () => {
    const parsed = BackgroundSchema.parse(undefined);
    expect(parsed.type).toBe("gradient");
    expect(parsed.media).toBeUndefined();
  });

  it("解析完整 media 配置", () => {
    const parsed = BackgroundSchema.parse({
      type: "video",
      media: {
        src: "bg/clip.mp4",
        opacity: 0.8,
        blur: 4,
        scale: "cover",
        position: "center",
        videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 },
      },
    });
    expect(parsed.type).toBe("video");
    expect(parsed.media?.scale).toBe("cover");
    expect(parsed.media?.videoOptions?.loop).toBe(true);
  });

  it("media 各字段有默认值", () => {
    const parsed = BackgroundSchema.parse({ type: "image", media: { src: "bg/x.png" } });
    expect(parsed.media?.opacity).toBe(1);
    expect(parsed.media?.blur).toBe(0);
    expect(parsed.media?.scale).toBe("cover");
    expect(parsed.media?.position).toBe("center");
  });
});

describe("RadarVideoSchema background 兼容", () => {
  it("旧配置（无 background）解析后回落 gradient", () => {
    const legacy = makePage(); // 不含 background 字段的合法 props
    // @ts-expect-error 故意删除以模拟旧数据
    delete legacy.background;
    const parsed = RadarVideoSchema.parse(legacy);
    expect(parsed.background.type).toBe("gradient");
  });
});

describe("defaultBackground", () => {
  it("defaultBackground 是 gradient 类型", () => {
    expect(defaultBackground.type).toBe("gradient");
    expect(defaultBackground.media).toBeUndefined();
  });
});

describe("ComparisonPairSchema overlay 兼容", () => {
  // 模拟 localStorage 里 layout/overlay 出现前的旧对比配置
  const legacyPair = {
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
  };

  it("旧 pair（无 layout/overlay）parse 后回填 transition + 全默认 overlay", () => {
    const parsed = ComparisonPairSchema.parse(legacyPair);
    expect(parsed.layout).toBe("transition");
    expect(parsed.overlay).toEqual(defaultOverlayHighlightConfig);
  });

  it("MultiPage 带 overlay pair 解析往返", () => {
    const config = {
      pages: [makePage(), makePage()],
      musicUrl: "",
      comparisons: [
        {
          ...legacyPair,
          layout: "overlay",
          overlay: {
            ...defaultOverlayHighlightConfig,
            highlightOrder: "right-first",
            dimOpacity: 0.5,
          },
        },
      ],
    };
    const parsed = MultiPageSchema.parse(config);
    expect(parsed.comparisons[0].layout).toBe("overlay");
    expect(parsed.comparisons[0].overlay.highlightOrder).toBe("right-first");
    expect(parsed.comparisons[0].overlay.dimOpacity).toBe(0.5);
    expect(parsed.comparisons[0].overlay.delayAfterFill).toBe(
      defaultOverlayHighlightConfig.delayAfterFill,
    );
  });

  it("overlay 部分字段缺失时按字段回填默认值", () => {
    const parsed = OverlayHighlightSchema.parse({ glowRadius: 30 });
    expect(parsed.glowRadius).toBe(30);
    expect({ ...parsed, glowRadius: defaultOverlayHighlightConfig.glowRadius }).toEqual(
      defaultOverlayHighlightConfig,
    );
  });

  it("constants 默认值与 schema 回填深相等（守卫双份内联字面量）", () => {
    // radar.ts 里 ComparisonPairSchema 的整块 .default() 字面量不能 import
    // constants（循环依赖），一致性由本用例守卫
    expect(OverlayHighlightSchema.parse({})).toEqual(defaultOverlayHighlightConfig);
    expect(defaultComparisonConfig.layout).toBe("transition");
    expect(defaultComparisonConfig.overlay).toEqual(defaultOverlayHighlightConfig);
    expect(ComparisonPairSchema.parse(legacyPair)).toEqual({
      ...defaultComparisonConfig,
      firstPageIndex: 0,
      secondPageIndex: 1,
    });
  });
});
