import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MultiPageVideo } from "@/remotion/MultiPageVideo";
import { defaultVideoPage, calculateDuration, defaultComparisonConfig } from "@/types/constants";
import type { MultiPageConfig, VideoPageConfig } from "@/types/radar";
import { makePage, makeMultiPageConfig } from "../components/editor/_fixtures";

// Sequence/AbsoluteFill/Audio 在 jsdom 下 mock 为可断言的标签；
// RadarVideo/VideoPage 替换为标识标签，仅断言编排（from/duration/顺序/组件选择）。
vi.mock("remotion", async (orig) => {
  const actual = await orig<typeof import("remotion")>();
  return {
    ...actual,
    Sequence: (p: { from?: number; durationInFrames?: number; children?: React.ReactNode }) => (
      <div data-testid="sequence" data-from={p.from ?? 0} data-duration={p.durationInFrames}>
        {p.children}
      </div>
    ),
    Audio: () => <div data-testid="audio" />,
    staticFile: (s: string) => `/static/${s}`,
  };
});

vi.mock("@/remotion/RadarVideo", () => ({
  RadarVideo: (p: Record<string, unknown>) => (
    <div
      data-testid="radar-video"
      data-name={p.characterName as string}
      data-comparison={String(Boolean(p.comparison))}
    />
  ),
}));

vi.mock("@/remotion/VideoPage", () => ({
  VideoPage: (p: { page: VideoPageConfig }) => (
    <div data-testid="video-page" data-label={p.page.label} data-src={p.page.src} />
  ),
}));

const overrideSpy = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("@/lib/global-override", async (orig) => {
  const actual = await orig<typeof import("@/lib/global-override")>();
  return {
    ...actual,
    applyGlobalOverride: vi.fn((page, override) => {
      overrideSpy.calls.push(page.characterName ?? "unknown");
      return actual.applyGlobalOverride(page, override);
    }),
  };
});

function makeVideoPage(overrides: Partial<VideoPageConfig> = {}): VideoPageConfig {
  return { ...defaultVideoPage, src: "uploads/a.mp4", ...overrides };
}

function topSequences(container: HTMLElement): HTMLElement[] {
  // 顶层 Sequence：直接位于最外层 AbsoluteFill 下（排除 videoOverlap 内嵌子 Sequence）
  return Array.from(container.querySelectorAll("[data-testid=sequence]")).filter(
    (el) => !el.parentElement?.closest("[data-testid=sequence]"),
  ) as HTMLElement[];
}

describe("MultiPageVideo 视频页编排", () => {
  it("[radar, video, radar] 输出三个顶层 Sequence，from 依次累加", () => {
    const cfg = makeMultiPageConfig(2);
    const video = makeVideoPage({ durationInFrames: 120, label: "插播" });
    cfg.pages = [cfg.pages[0], video, cfg.pages[1]];
    const { container, getAllByTestId } = render(<MultiPageVideo config={cfg} />);

    const seqs = topSequences(container);
    expect(seqs).toHaveLength(3);
    const radarDur = calculateDuration(makePage().animation);
    expect(seqs[0].getAttribute("data-from")).toBe("0");
    expect(seqs[0].getAttribute("data-duration")).toBe(String(radarDur));
    expect(seqs[1].getAttribute("data-from")).toBe(String(radarDur));
    expect(seqs[1].getAttribute("data-duration")).toBe("120");
    expect(seqs[2].getAttribute("data-from")).toBe(String(radarDur + 120));
    expect(getAllByTestId("video-page")).toHaveLength(1);
    expect(seqs[1].querySelector("[data-testid=video-page]")).toBeTruthy();
  });

  it("[radar, radar] + 配对输出单个对比 Sequence（现状回归）", () => {
    const cfg = makeMultiPageConfig(2);
    cfg.comparisons = [{ ...defaultComparisonConfig, firstPageIndex: 0, secondPageIndex: 1 }];
    const { container } = render(<MultiPageVideo config={cfg} />);
    const seqs = topSequences(container);
    expect(seqs).toHaveLength(1);
    expect(seqs[0].querySelector("[data-comparison=true]")).toBeTruthy();
  });

  it("[radar, video] + 配对(0,1) 时配对被忽略，输出两个独立 Sequence", () => {
    const cfg = makeMultiPageConfig(1);
    cfg.pages = [cfg.pages[0], makeVideoPage({ durationInFrames: 100 })];
    cfg.comparisons = [{ ...defaultComparisonConfig, firstPageIndex: 0, secondPageIndex: 1 }];
    const { container } = render(<MultiPageVideo config={cfg} />);
    const seqs = topSequences(container);
    expect(seqs).toHaveLength(2);
    expect(container.querySelector("[data-comparison=true]")).toBeNull();
  });

  it("视频页不经过 applyGlobalOverride", () => {
    overrideSpy.calls.length = 0;
    const cfg = makeMultiPageConfig(1);
    cfg.pages = [cfg.pages[0], makeVideoPage()];
    render(<MultiPageVideo config={cfg} />);
    expect(overrideSpy.calls).toHaveLength(1);
  });

  it("[video(100), video(200)] + 重叠(0,1,offset=60) 输出单个外层 Sequence 时长 260，内嵌两子 Sequence", () => {
    const cfg = makeMultiPageConfig(0);
    cfg.pages = [
      makeVideoPage({ durationInFrames: 100, label: "甲" }),
      makeVideoPage({ durationInFrames: 200, label: "乙" }),
    ];
    cfg.videoOverlaps = [
      { firstPageIndex: 0, secondPageIndex: 1, offsetFrames: 60, topLayer: "second" },
    ];
    const { container } = render(<MultiPageVideo config={cfg} />);
    const seqs = topSequences(container);
    expect(seqs).toHaveLength(1);
    expect(seqs[0].getAttribute("data-duration")).toBe("260");

    const inner = Array.from(seqs[0].querySelectorAll("[data-testid=sequence]")) as HTMLElement[];
    expect(inner).toHaveLength(2);
    const first = inner.find((el) => el.querySelector("[data-label=甲]"))!;
    const second = inner.find((el) => el.querySelector("[data-label=乙]"))!;
    expect(first.getAttribute("data-from")).toBe("0");
    expect(first.getAttribute("data-duration")).toBe("100");
    expect(second.getAttribute("data-from")).toBe("60");
    expect(second.getAttribute("data-duration")).toBe("200");
    // 默认 topLayer=second：second 在 DOM 中后渲染（上层）
    expect(inner.indexOf(second)).toBeGreaterThan(inner.indexOf(first));
  });

  it("重叠 topLayer=first 时 first 子 Sequence 在 DOM 中后渲染", () => {
    const cfg = makeMultiPageConfig(0);
    cfg.pages = [
      makeVideoPage({ durationInFrames: 100, label: "甲" }),
      makeVideoPage({ durationInFrames: 200, label: "乙" }),
    ];
    cfg.videoOverlaps = [
      { firstPageIndex: 0, secondPageIndex: 1, offsetFrames: 60, topLayer: "first" },
    ];
    const { container } = render(<MultiPageVideo config={cfg} />);
    const inner = Array.from(
      topSequences(container)[0].querySelectorAll("[data-testid=sequence]"),
    ) as HTMLElement[];
    const first = inner.find((el) => el.querySelector("[data-label=甲]"))!;
    const second = inner.find((el) => el.querySelector("[data-label=乙]"))!;
    expect(inner.indexOf(first)).toBeGreaterThan(inner.indexOf(second));
  });

  it("[radar, video] + 重叠(0,1) 任一侧非视频页时重叠被忽略，两个独立 Sequence", () => {
    const cfg = makeMultiPageConfig(1);
    cfg.pages = [cfg.pages[0], makeVideoPage({ durationInFrames: 100 })];
    cfg.videoOverlaps = [
      { firstPageIndex: 0, secondPageIndex: 1, offsetFrames: 60, topLayer: "second" },
    ];
    const { container } = render(<MultiPageVideo config={cfg} />);
    expect(topSequences(container)).toHaveLength(2);
  });

  it("[video, video] 同一对同时配 comparisons 与 videoOverlaps 时 overlap 生效（互斥守卫）", () => {
    const cfg = makeMultiPageConfig(0);
    cfg.pages = [
      makeVideoPage({ durationInFrames: 100 }),
      makeVideoPage({ durationInFrames: 200 }),
    ];
    cfg.comparisons = [{ ...defaultComparisonConfig, firstPageIndex: 0, secondPageIndex: 1 }];
    cfg.videoOverlaps = [
      { firstPageIndex: 0, secondPageIndex: 1, offsetFrames: 60, topLayer: "second" },
    ];
    const { container } = render(<MultiPageVideo config={cfg} />);
    const seqs = topSequences(container);
    expect(seqs).toHaveLength(1);
    expect(seqs[0].getAttribute("data-duration")).toBe("260");
    expect(container.querySelector("[data-comparison=true]")).toBeNull();
  });
});
