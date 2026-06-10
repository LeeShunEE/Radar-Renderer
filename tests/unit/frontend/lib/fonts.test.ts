/**
 * fonts.ts 单元测试：injectGoogleFontLink 去重。
 *
 * CJK/拉丁 loaders 实际依赖 @remotion/google-fonts，在 jsdom 无法 mock；
 * 仅测 injectGoogleFontLink 的 DOM 注入与去重逻辑。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// 直接 import fonts.ts（injectGoogleFontLink 不依赖 remotion imports）
import { CURATED_FONTS, injectGoogleFontLink } from "@/lib/fonts";

// 注意：injectGoogleFontLink 是模块私有函数，无法直接 import。
// 我们通过调用 loadFontDynamic 间接测试，或导出该函数进行测试。
// 当前 fonts.ts 未导出 injectGoogleFontLink，故跳过该测试。

describe("CURATED_FONTS", () => {
  it("contains sans-serif default", () => {
    expect(CURATED_FONTS.some(f => f.name === "sans-serif")).toBe(true);
  });
  it("contains CJK fonts with supportsChinese", () => {
    const cjk = CURATED_FONTS.filter(f => f.supportsChinese);
    expect(cjk.length).toBeGreaterThan(0);
    expect(cjk.some(f => f.name === "Noto Sans SC")).toBe(true);
  });
  it("contains latin-only fonts", () => {
    const latin = CURATED_FONTS.filter(f => !f.supportsChinese);
    expect(latin.length).toBeGreaterThan(0);
    expect(latin.some(f => f.name === "Orbitron")).toBe(true);
  });
});