import { describe, it, expect } from "vitest";
import {
  checkBackgroundVideo,
  mediaKindFromSrc,
  BG_VIDEO_SIZE_WARN_BYTES,
} from "@/lib/media-guard";

describe("checkBackgroundVideo", () => {
  it("超 50MB 给体积警告", () => {
    const w = checkBackgroundVideo({ width: 1920, height: 1080, sizeBytes: BG_VIDEO_SIZE_WARN_BYTES + 1 });
    expect(w.some((m) => m.code === "size")).toBe(true);
  });
  it("超 1080p 给分辨率警告", () => {
    const w = checkBackgroundVideo({ width: 3840, height: 2160, sizeBytes: 1000 });
    expect(w.some((m) => m.code === "resolution")).toBe(true);
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

describe("mediaKindFromSrc", () => {
  it("视频扩展名 → video（大小写不敏感）", () => {
    expect(mediaKindFromSrc("bg.mp4")).toBe("video");
    expect(mediaKindFromSrc("clips/BG.WebM")).toBe("video");
    expect(mediaKindFromSrc("a.mov")).toBe("video");
  });
  it("图片扩展名 → image", () => {
    expect(mediaKindFromSrc("bg.png")).toBe("image");
    expect(mediaKindFromSrc("photo.JPEG")).toBe("image");
    expect(mediaKindFromSrc("anim.gif")).toBe("image");
    expect(mediaKindFromSrc("v.svg")).toBe("image");
  });
  it("完整下载 URL 带查询串也能识别", () => {
    expect(mediaKindFromSrc("http://host/api/files/download/bg.mp4?token=x")).toBe("video");
    expect(mediaKindFromSrc("http://host/api/files/download/bg.png#frag")).toBe("image");
  });
  it("空串 / blob URL / 未知扩展名 → null", () => {
    expect(mediaKindFromSrc("")).toBeNull();
    expect(mediaKindFromSrc("blob:http://host/uuid")).toBeNull();
    expect(mediaKindFromSrc("file.txt")).toBeNull();
  });
});
