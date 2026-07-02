/**
 * types/constants.ts 单元测试：overlay 高亮编排的时长数学 + 对比时长分支。
 *
 * 时长关键数学全部集中在 constants.ts（computeOverlayPhases /
 * calculateComparisonDuration），组件只消费关键帧，保证纯函数可测。
 */
import { describe, it, expect } from "vitest";
import {
  calculateComparisonDuration,
  calculateDuration,
  computeOverlayPhases,
  defaultComparisonConfig,
  defaultOverlayHighlightConfig,
  defaultRadarProps,
} from "@/types/constants";
import type { ComparisonPairConfig } from "@/types/radar";
import { makePage } from "../components/editor/_fixtures";

const defaultAnimation = defaultRadarProps.animation;

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
