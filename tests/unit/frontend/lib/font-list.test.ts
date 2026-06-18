/**
 * font-list.ts 单元测试：验证自动生成的字体清单结构。
 *
 * 该文件是 scripts/generate-font-list.mjs 生成的纯数据导出（ALL_FONTS 数组），
 * 模块加载即执行数组字面量；断言其结构与已知条目即可覆盖。
 */
import { describe, it, expect } from "vitest";
import { ALL_FONTS } from "@/lib/font-list";

describe("font-list", () => {
  it("ALL_FONTS 非空且每项含 module/name 字段", () => {
    expect(ALL_FONTS.length).toBeGreaterThan(100);
    for (const entry of ALL_FONTS) {
      expect(typeof entry.module).toBe("string");
      expect(typeof entry.name).toBe("string");
      expect(entry.module.length).toBeGreaterThan(0);
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  it("module 唯一（生成脚本的去重不变量）", () => {
    const modules = ALL_FONTS.map((f) => f.module);
    expect(new Set(modules).size).toBe(modules.length);
  });

  it("含已知 CJK 与拉丁条目", () => {
    expect(ALL_FONTS.some((f) => f.module === "NotoSansSC" && f.name === "Noto Sans SC")).toBe(true);
    expect(ALL_FONTS.some((f) => f.module === "Orbitron" && f.name === "Orbitron")).toBe(true);
  });
});
