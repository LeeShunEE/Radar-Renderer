/**
 * types/constants.ts 单元测试：overlay 高亮编排的时长数学 + 对比时长分支 +
 * 视频页/重叠统一时长。
 *
 * 时长关键数学全部集中在 constants.ts（computeOverlayPhases /
 * calculateComparisonDuration / calculateMultiPageTotalFrames），
 * 组件只消费关键帧，保证纯函数可测。
 */
import { describe, it, expect } from "vitest";
import {
  calculateComparisonDuration,
  calculateDuration,
  computeOverlayPhases,
  defaultVideoPage,
  calculatePageDuration,
  calculateVideoOverlapDuration,
  calculateMultiPageTotalFrames,
  defaultComparisonConfig,
  defaultOverlayHighlightConfig,
  defaultRadarProps,
} from "@/types/constants";
import { isVideoPage } from "@/types/radar";
import type { ComparisonPairConfig, MultiPageConfig, VideoPageConfig } from "@/types/radar";
import { makePage, makeMultiPageConfig } from "../components/editor/_fixtures";

const defaultAnimation = defaultRadarProps.animation;

function makeVideoPage(overrides: Partial<VideoPageConfig> = {}): VideoPageConfig {
  return { ...defaultVideoPage, src: "uploads/a.mp4", ...overrides };
}

describe("computeOverlayPhases", () => {
  it("默认 animation + 默认 overlay 的关键帧逐值正确", () => {
    // labelStart=10, labelEnd=10+3*8=34, fillStart=34-10=24, fillEnd=24+45=69
    const phases = computeOverlayPhases(defaultAnimation, defaultOverlayHighlightConfig);
    expect(phases.dotsSettled).toBe(99); // fillEnd 69 + 30
    expect(phases.p1).toBe(117); // dotsSettled + delayAfterFill 18
    expect(phases.p2).toBe(131); // + transitionFrames 14
    expect(phases.p3).toBe(173); // + holdFrames 42
    expect(phases.p4).toBe(187); // + transitionFrames 14
    expect(phases.p5).toBe(229); // + holdFrames 42
    expect(phases.p6).toBe(243); // + transitionFrames 14
    expect(phases.total).toBe(313); // p6 + holdTailFrames 70
  });

  it("负 fillStartOffset 使 fillStart < 0 时延长 total", () => {
    // labelEnd=34, fillStartOffset=-60 → fillStart=-26 → 负向前导 26 帧并入总长
    const animation = { ...defaultAnimation, fillStartOffset: -60 };
    const phases = computeOverlayPhases(animation, defaultOverlayHighlightConfig);
    expect(phases.total).toBe(
      phases.p6 + defaultOverlayHighlightConfig.holdTailFrames + 26,
    );
  });

  it("overlay 参数变化线性影响关键帧", () => {
    const overlay = {
      ...defaultOverlayHighlightConfig,
      delayAfterFill: 0,
      transitionFrames: 10,
      holdFrames: 20,
      holdTailFrames: 0,
    };
    const phases = computeOverlayPhases(defaultAnimation, overlay);
    expect(phases.p1).toBe(phases.dotsSettled);
    expect(phases.p6).toBe(phases.dotsSettled + 10 + 20 + 10 + 20 + 10);
    expect(phases.total).toBe(phases.p6);
  });
});

describe("calculateComparisonDuration", () => {
  const left = makePage();
  const right = makePage();

  it("transition 分支回归：leftEnd + delay + rightLen", () => {
    const dur = calculateComparisonDuration(left, right, defaultComparisonConfig);
    const leftEnd = calculateDuration(left.animation);
    const rightLen = calculateDuration(right.animation);
    expect(dur).toBe(
      Math.max(leftEnd, leftEnd + defaultComparisonConfig.delayFrames + rightLen),
    );
  });

  it("overlay 分支 = computeOverlayPhases(左页 animation).total", () => {
    const config: ComparisonPairConfig = {
      ...defaultComparisonConfig,
      layout: "overlay",
    };
    expect(calculateComparisonDuration(left, right, config)).toBe(
      computeOverlayPhases(left.animation, defaultOverlayHighlightConfig).total,
    );
  });

  it("overlay 节奏只取左页 animation（右页 animation 时序被忽略）", () => {
    const config: ComparisonPairConfig = {
      ...defaultComparisonConfig,
      layout: "overlay",
    };
    const slowRight = makePage({
      animation: { ...right.animation, fillDuration: 120, holdDuration: 600 },
    });
    expect(calculateComparisonDuration(left, slowRight, config)).toBe(
      calculateComparisonDuration(left, right, config),
    );
  });

  it("运行时旧配置缺 layout 时回落 transition", () => {
    // useAutoSave 的运行时对象不经 schema 回填，可能没有新字段
    const { layout: _layout, overlay: _overlay, ...legacy } = defaultComparisonConfig;
    expect(calculateComparisonDuration(left, right, legacy)).toBe(
      calculateComparisonDuration(left, right, defaultComparisonConfig),
    );
  });

  it("layout=overlay 但缺 overlay 字段时回落默认 overlay 参数", () => {
    const { overlay: _overlay, ...rest } = defaultComparisonConfig;
    const config: ComparisonPairConfig = { ...rest, layout: "overlay" };
    expect(calculateComparisonDuration(left, right, config)).toBe(
      computeOverlayPhases(left.animation, defaultOverlayHighlightConfig).total,
    );
  });
});

describe("defaultVideoPage", () => {
  it("是合法的视频页配置", () => {
    expect(isVideoPage(defaultVideoPage)).toBe(true);
    expect(defaultVideoPage.src).toBe("");
    expect(defaultVideoPage.durationInFrames).toBe(150);
    expect(defaultVideoPage.chromaKey.enabled).toBe(false);
  });
});

describe("calculatePageDuration", () => {
  it("雷达页走动画时长", () => {
    const page = makePage();
    expect(calculatePageDuration(page)).toBe(calculateDuration(page.animation));
  });

  it("视频页直接取 durationInFrames", () => {
    expect(calculatePageDuration(makeVideoPage({ durationInFrames: 240 }))).toBe(240);
  });
});

describe("calculateVideoOverlapDuration", () => {
  it("offset + dur2 更长时取第二段末尾", () => {
    expect(calculateVideoOverlapDuration(100, 200, { offsetFrames: 60 })).toBe(260);
  });

  it("第一段更长时取第一段末尾", () => {
    expect(calculateVideoOverlapDuration(300, 100, { offsetFrames: 60 })).toBe(300);
  });

  it("offset 超过 dur1 留空档也合法", () => {
    expect(calculateVideoOverlapDuration(100, 100, { offsetFrames: 150 })).toBe(250);
  });
});

describe("calculateMultiPageTotalFrames", () => {
  const radarFrames = (cfg: MultiPageConfig, i: number) => {
    const page = cfg.pages[i];
    if (isVideoPage(page)) throw new Error("fixture 应为雷达页");
    return calculateDuration(page.animation);
  };

  it("纯雷达页无配对时为各页之和（回归）", () => {
    const cfg = makeMultiPageConfig(2);
    expect(calculateMultiPageTotalFrames(cfg)).toBe(radarFrames(cfg, 0) + radarFrames(cfg, 1));
  });

  it("纯雷达页 + 配对与现状 calculateComparisonDuration 一致（回归）", () => {
    const cfg = makeMultiPageConfig(2);
    cfg.comparisons = [{ ...defaultComparisonConfig, firstPageIndex: 0, secondPageIndex: 1 }];
    const expected =
      Math.max(
        radarFrames(cfg, 0),
        radarFrames(cfg, 0) + defaultComparisonConfig.delayFrames + radarFrames(cfg, 1),
      );
    expect(calculateMultiPageTotalFrames(cfg)).toBe(expected);
  });

  it("[radar, video(240), radar] 为三段之和", () => {
    const cfg = makeMultiPageConfig(2);
    cfg.pages = [cfg.pages[0], makeVideoPage({ durationInFrames: 240 }), cfg.pages[1]];
    expect(calculateMultiPageTotalFrames(cfg)).toBe(
      radarFrames(cfg, 0) + 240 + radarFrames(cfg, 2),
    );
  });

  it("[radar, video] + 配对(0,1) 时配对被忽略，两段之和", () => {
    const cfg = makeMultiPageConfig(1);
    cfg.pages = [cfg.pages[0], makeVideoPage({ durationInFrames: 100 })];
    cfg.comparisons = [{ ...defaultComparisonConfig, firstPageIndex: 0, secondPageIndex: 1 }];
    expect(calculateMultiPageTotalFrames(cfg)).toBe(radarFrames(cfg, 0) + 100);
  });

  it("[video(100), video(200)] + 重叠(0,1,offset=60) 总长 260", () => {
    const cfg = makeMultiPageConfig(0);
    cfg.pages = [
      makeVideoPage({ durationInFrames: 100 }),
      makeVideoPage({ durationInFrames: 200 }),
    ];
    cfg.videoOverlaps = [
      { firstPageIndex: 0, secondPageIndex: 1, offsetFrames: 60, topLayer: "second" },
    ];
    expect(calculateMultiPageTotalFrames(cfg)).toBe(260);
  });

  it("[radar, video(100), video(200), radar] + 重叠(1,2,offset=60) 为 radar + 260 + radar", () => {
    const cfg = makeMultiPageConfig(2);
    cfg.pages = [
      cfg.pages[0],
      makeVideoPage({ durationInFrames: 100 }),
      makeVideoPage({ durationInFrames: 200 }),
      cfg.pages[1],
    ];
    cfg.videoOverlaps = [
      { firstPageIndex: 1, secondPageIndex: 2, offsetFrames: 60, topLayer: "second" },
    ];
    expect(calculateMultiPageTotalFrames(cfg)).toBe(
      radarFrames(cfg, 0) + 260 + radarFrames(cfg, 3),
    );
  });

  it("[radar, video] + 重叠(0,1) 任一侧非视频页时被忽略", () => {
    const cfg = makeMultiPageConfig(1);
    cfg.pages = [cfg.pages[0], makeVideoPage({ durationInFrames: 100 })];
    cfg.videoOverlaps = [
      { firstPageIndex: 0, secondPageIndex: 1, offsetFrames: 60, topLayer: "second" },
    ];
    expect(calculateMultiPageTotalFrames(cfg)).toBe(radarFrames(cfg, 0) + 100);
  });
});
