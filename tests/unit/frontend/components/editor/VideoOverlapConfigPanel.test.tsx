/**
 * VideoOverlapConfigPanel 单元测试：相邻视频页对枚举、勾选写入/取消移除 videoOverlaps、
 * offsetFrames/topLayer 载荷、只读重叠段总时长、空态。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoOverlapConfigPanel } from "@/components/editor/VideoOverlapConfigPanel";
import { makeMultiPageConfig } from "./_fixtures";
import { defaultVideoPage } from "@/types/constants";
import type { MultiPageConfig } from "@/types/radar";

const videoPage = (label: string) => ({ ...defaultVideoPage, label });

const configWithVideoPair = (): MultiPageConfig => ({
  ...makeMultiPageConfig(),
  pages: [videoPage("V1"), videoPage("V2")],
});

// 混排：[radar, V1, V2, radar] —— 仅 (1,2) 是相邻视频对
const configMixed = (): MultiPageConfig => ({
  ...makeMultiPageConfig(),
  pages: [
    makeMultiPageConfig(1).pages[0],
    videoPage("V1"),
    videoPage("V2"),
    makeMultiPageConfig(1).pages[0],
  ],
});

describe("VideoOverlapConfigPanel", () => {
  let onChange: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    onChange = vi.fn();
  });

  it("无相邻视频页对时显示空态", () => {
    render(<VideoOverlapConfigPanel config={makeMultiPageConfig()} onChange={onChange} />);
    expect(screen.getByText(/需要两个相邻的视频页/)).toBeInTheDocument();
  });

  it("枚举相邻视频页对（跳过混排中的雷达页与非相邻对）", () => {
    render(<VideoOverlapConfigPanel config={configMixed()} onChange={onChange} />);
    expect(screen.getByText(/V1/)).toBeInTheDocument();
    expect(screen.getByText(/V2/)).toBeInTheDocument();
    // 仅 (1,2) 一对 → 1 个⚡重叠按钮
    expect(screen.getAllByRole("button", { name: /重叠/ })).toHaveLength(1);
  });

  it("勾选⚡重叠写入 videoOverlaps（默认 offset=0、topLayer=second）", () => {
    render(<VideoOverlapConfigPanel config={configWithVideoPair()} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /重叠/ }));
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.videoOverlaps).toHaveLength(1);
    expect(next.videoOverlaps[0]).toMatchObject({
      firstPageIndex: 0,
      secondPageIndex: 1,
      offsetFrames: 0,
      topLayer: "second",
    });
  });

  it("取消⚡重叠移除 videoOverlaps", () => {
    const cfg = configWithVideoPair();
    cfg.videoOverlaps = [
      { firstPageIndex: 0, secondPageIndex: 1, offsetFrames: 30, topLayer: "first" },
    ];
    render(<VideoOverlapConfigPanel config={cfg} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /重叠/ }));
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.videoOverlaps).toHaveLength(0);
  });

  it("offsetFrames 数字输入 → videoOverlaps.offsetFrames（≥0）", () => {
    const cfg = configWithVideoPair();
    cfg.videoOverlaps = [
      { firstPageIndex: 0, secondPageIndex: 1, offsetFrames: 0, topLayer: "second" },
    ];
    render(<VideoOverlapConfigPanel config={cfg} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("vp-overlap-offset-0"), { target: { value: "60" } });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.videoOverlaps[0].offsetFrames).toBe(60);
  });

  it("topLayer 选择 → videoOverlaps.topLayer", () => {
    const cfg = configWithVideoPair();
    cfg.videoOverlaps = [
      { firstPageIndex: 0, secondPageIndex: 1, offsetFrames: 0, topLayer: "second" },
    ];
    render(<VideoOverlapConfigPanel config={cfg} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("vp-overlap-top-0"), { target: { value: "first" } });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.videoOverlaps[0].topLayer).toBe("first");
  });

  it("只读展示重叠段总时长（max(dur1, offset+dur2)）", () => {
    const cfg = configWithVideoPair();
    // V1=150, V2=150, offset=60 → max(150, 60+150)=210
    cfg.videoOverlaps = [
      { firstPageIndex: 0, secondPageIndex: 1, offsetFrames: 60, topLayer: "second" },
    ];
    render(<VideoOverlapConfigPanel config={cfg} onChange={onChange} />);
    expect(screen.getByText(/210/)).toBeInTheDocument();
  });
});
