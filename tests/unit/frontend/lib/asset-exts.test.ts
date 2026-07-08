/**
 * asset-exts 单元测试：扩展名清单与正则工厂（flac 回归防漂移）。
 */
import { describe, it, expect } from "vitest";
import { AUDIO_EXTS, IMAGE_EXTS, VIDEO_EXTS, extRegex } from "@/lib/asset-exts";

describe("asset-exts", () => {
  describe("AUDIO_EXTS", () => {
    it("包含 flac（与后端 _AUDIO_EXTS 对齐，bug 回归）", () => {
      expect(AUDIO_EXTS).toContain("flac");
    });

    it("包含常见音频扩展名", () => {
      for (const ext of ["mp3", "wav", "ogg", "m4a", "aac"]) {
        expect(AUDIO_EXTS).toContain(ext);
      }
    });
  });

  describe("extRegex", () => {
    it("匹配 .flac 与大写 .FLAC（大小写不敏感）", () => {
      const re = extRegex(AUDIO_EXTS);
      expect(re.test("song.flac")).toBe(true);
      expect(re.test("SONG.FLAC")).toBe(true);
    });

    it("拒绝清单外扩展名", () => {
      const re = extRegex(AUDIO_EXTS);
      expect(re.test("note.txt")).toBe(false);
      expect(re.test("image.png")).toBe(false);
    });

    it("末尾锚定：扩展名必须在文件名结尾", () => {
      const re = extRegex(AUDIO_EXTS);
      expect(re.test("song.flac.txt")).toBe(false);
      expect(re.test("song.mp3.bak")).toBe(false);
    });

    it("合并清单可匹配图片与视频", () => {
      const re = extRegex([...IMAGE_EXTS, ...VIDEO_EXTS]);
      expect(re.test("bg.png")).toBe(true);
      expect(re.test("bg.mp4")).toBe(true);
      expect(re.test("bg.flac")).toBe(false);
    });
  });
});
