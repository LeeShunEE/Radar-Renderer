/**
 * formatEtaSeconds 单元测试：取整、秒/整分/分+秒分支。
 */
import { describe, it, expect } from "vitest";
import { formatEtaSeconds } from "@/lib/format";

describe("formatEtaSeconds", () => {
  it("小于 60 秒格式化为「N 秒」", () => {
    expect(formatEtaSeconds(45)).toBe("45 秒");
  });

  it("整分钟格式化为「N 分钟」", () => {
    expect(formatEtaSeconds(120)).toBe("2 分钟");
  });

  it("带余秒格式化为「N 分 M 秒」", () => {
    expect(formatEtaSeconds(90)).toBe("1 分 30 秒");
  });

  it("小数秒先取整", () => {
    expect(formatEtaSeconds(45.7)).toBe("46 秒");
    expect(formatEtaSeconds(89.4)).toBe("1 分 29 秒");
  });

  it("0 秒格式化为「0 秒」", () => {
    expect(formatEtaSeconds(0)).toBe("0 秒");
  });
});
