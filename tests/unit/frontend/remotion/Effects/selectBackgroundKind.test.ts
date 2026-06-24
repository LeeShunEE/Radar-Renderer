import { describe, it, expect } from "vitest";
import { selectBackgroundKind } from "@/remotion/Effects/selectBackgroundKind";
import type { BackgroundConfig } from "@/types/radar";

const bg = (over: Partial<BackgroundConfig> = {}): BackgroundConfig => ({
  type: "gradient",
  ...over,
});

describe("selectBackgroundKind", () => {
  it("type=gradient → 'gradient'", () => {
    expect(selectBackgroundKind(bg({ type: "gradient" }))).toBe("gradient");
  });

  it("type=image + 有效 src → 'media'", () => {
    expect(
      selectBackgroundKind(bg({ type: "image", media: { src: "bg/hero.png", opacity: 1, blur: 0, scale: "cover", position: "center", videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 } } })),
    ).toBe("media");
  });

  it("type=video + 有效 src → 'media'", () => {
    expect(
      selectBackgroundKind(bg({ type: "video", media: { src: "bg/loop.mp4", opacity: 1, blur: 0, scale: "cover", position: "center", videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 } } })),
    ).toBe("media");
  });

  it("type=image + 空 src → 回落 'gradient'", () => {
    expect(
      selectBackgroundKind(bg({ type: "image", media: { src: "", opacity: 1, blur: 0, scale: "cover", position: "center", videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 } } })),
    ).toBe("gradient");
  });

  it("type=video + media 未定义 → 回落 'gradient'", () => {
    expect(selectBackgroundKind(bg({ type: "video" }))).toBe("gradient");
  });

  it("type=gradient + media 有 src → 仍然 'gradient'（type 优先）", () => {
    expect(
      selectBackgroundKind(bg({ type: "gradient", media: { src: "bg/hero.png", opacity: 1, blur: 0, scale: "cover", position: "center", videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 } } })),
    ).toBe("gradient");
  });
});
