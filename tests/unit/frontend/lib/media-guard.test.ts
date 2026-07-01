import { describe, it, expect } from "vitest";
import { checkBackgroundVideo, BG_VIDEO_SIZE_WARN_BYTES } from "@/lib/media-guard";

describe("checkBackgroundVideo", () => {
  it("超 50MB 给体积警告", () => {
    const w = checkBackgroundVideo({ width: 1920, height: 1080, sizeBytes: BG_VIDEO_SIZE_WARN_BYTES + 1 });
    expect(w.some((m) => m.includes("体积"))).toBe(true);
  });
  it("超 1080p 给分辨率警告", () => {
    const w = checkBackgroundVideo({ width: 3840, height: 2160, sizeBytes: 1000 });
    expect(w.some((m) => m.includes("分辨率"))).toBe(true);
  });
  it("正常视频无警告", () => {
    expect(checkBackgroundVideo({ width: 1280, height: 720, sizeBytes: 1000 })).toEqual([]);
  });
  it("同时超体积与分辨率给两条警告", () => {
    const w = checkBackgroundVideo({ width: 3840, height: 2160, sizeBytes: BG_VIDEO_SIZE_WARN_BYTES + 1 });
    expect(w.length).toBe(2);
  });
  it("恰好 50MB / 1080p 边界不警告", () => {
    expect(checkBackgroundVideo({ width: 1920, height: 1080, sizeBytes: BG_VIDEO_SIZE_WARN_BYTES })).toEqual([]);
  });
});
