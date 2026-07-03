import { describe, it, expect } from "vitest";
import {
  RadarVideoSchema,
  BackgroundSchema,
  ComparisonPairSchema,
  MultiPageSchema,
  OverlayHighlightSchema,
  defaultBackground,
  VideoPageSchema,
  PageSchema,
  isVideoPage,
  VideoOverlapPairSchema,
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

describe("VideoPageSchema", () => {
  it("解析最小视频页配置并填默认值", () => {
    const parsed = VideoPageSchema.parse({ pageType: "video", src: "/api/v1/files/uploads/a.mp4" });
    expect(parsed.durationInFrames).toBe(150);
    expect(parsed.fit).toBe("contain");
    expect(parsed.audio).toEqual({ muted: false, volume: 1 });
    expect(parsed.chromaKey.enabled).toBe(false);
    expect(parsed.chromaKey.keyColor).toBe("#00ff00");
    expect(parsed.chromaKey.similarity).toBe(0.18);
    expect(parsed.chromaKey.smoothness).toBe(0.08);
    expect(parsed.chromaKey.spillSuppression).toBe(0.25);
    expect(parsed.background.type).toBe("gradient");
  });

  it("色键参数越界被拒绝", () => {
    expect(() =>
      VideoPageSchema.parse({ pageType: "video", src: "a.mp4", chromaKey: { similarity: 1.5 } }),
    ).toThrow();
  });

  it("durationInFrames 非正整数被拒绝", () => {
    expect(() => VideoPageSchema.parse({ pageType: "video", src: "a.mp4", durationInFrames: 0 })).toThrow();
    expect(() => VideoPageSchema.parse({ pageType: "video", src: "a.mp4", durationInFrames: 1.5 })).toThrow();
  });
});

describe("PageSchema union 向后兼容", () => {
  it("无 pageType 的旧雷达页解析为雷达页", () => {
    const parsed = PageSchema.parse(makePage());
    expect(isVideoPage(parsed)).toBe(false);
  });

  it("pageType=video 解析为视频页", () => {
    const parsed = PageSchema.parse({ pageType: "video", src: "a.mp4" });
    expect(isVideoPage(parsed)).toBe(true);
  });

  it("MultiPageSchema 接受雷达页与视频页混排", () => {
    const cfg = MultiPageSchema.parse({
      pages: [makePage(), { pageType: "video", src: "a.mp4" }],
      musicUrl: "",
    });
    expect(cfg.pages).toHaveLength(2);
    expect(isVideoPage(cfg.pages[0])).toBe(false);
    expect(isVideoPage(cfg.pages[1])).toBe(true);
  });
});

describe("VideoOverlapPairSchema", () => {
  it("默认 offsetFrames=0、topLayer=second", () => {
    const parsed = VideoOverlapPairSchema.parse({ firstPageIndex: 1, secondPageIndex: 2 });
    expect(parsed.offsetFrames).toBe(0);
    expect(parsed.topLayer).toBe("second");
  });

  it("负 offsetFrames 被拒绝", () => {
    expect(() =>
      VideoOverlapPairSchema.parse({ firstPageIndex: 1, secondPageIndex: 2, offsetFrames: -1 }),
    ).toThrow();
  });

  it("MultiPageSchema 无 videoOverlaps 时回落空数组（旧配置兼容）", () => {
    const cfg = MultiPageSchema.parse({ pages: [makePage()], musicUrl: "" });
    expect(cfg.videoOverlaps).toEqual([]);
  });
});
