/**
 * formatEtaSeconds 单元测试：取整、秒/整分/分+秒分支、locale 切换。
 */
import { describe, it, expect } from "vitest";
import { formatEtaSeconds } from "@/lib/format";

describe("formatEtaSeconds", () => {
  describe("zh 文案", () => {
    it("小于 60 秒格式化为「N 秒」", () => {
      expect(formatEtaSeconds(45, "zh")).toBe("45 秒");
    });

    it("整分钟格式化为「N 分钟」", () => {
      expect(formatEtaSeconds(120, "zh")).toBe("2 分钟");
    });

    it("带余秒格式化为「N 分 M 秒」", () => {
      expect(formatEtaSeconds(90, "zh")).toBe("1 分 30 秒");
    });

    it("小数秒先取整", () => {
      expect(formatEtaSeconds(45.7, "zh")).toBe("46 秒");
      expect(formatEtaSeconds(89.4, "zh")).toBe("1 分 29 秒");
    });

    it("0 秒格式化为「0 秒」", () => {
      expect(formatEtaSeconds(0, "zh")).toBe("0 秒");
    });
  });

  describe("en 文案", () => {
    it("小于 60 秒格式化为「Ns」", () => {
      expect(formatEtaSeconds(45, "en")).toBe("45s");
    });

    it("整分钟格式化为「N min」", () => {
      expect(formatEtaSeconds(120, "en")).toBe("2 min");
    });

    it("带余秒格式化为「Nm Ms」", () => {
      expect(formatEtaSeconds(90, "en")).toBe("1m 30s");
    });

    it("默认 locale 为 en", () => {
      expect(formatEtaSeconds(45)).toBe("45s");
    });
  });
});
