/**
 * i18n 配置单元测试：locale 常量、默认值与 isLocale 类型守卫。
 */
import { describe, it, expect } from "vitest";
import {
  locales,
  defaultLocale,
  localeLabels,
  isLocale,
  LOCALE_COOKIE,
} from "@/i18n/config";

describe("i18n config", () => {
  it("默认 locale 为 en 且在 locales 内", () => {
    expect(defaultLocale).toBe("en");
    expect(locales).toContain(defaultLocale);
  });

  it("每个 locale 都有展示名", () => {
    for (const locale of locales) {
      expect(localeLabels[locale]).toBeTruthy();
    }
  });

  it("Cookie 名为 NEXT_LOCALE", () => {
    expect(LOCALE_COOKIE).toBe("NEXT_LOCALE");
  });

  describe("isLocale", () => {
    it("受支持的 locale 返回 true", () => {
      expect(isLocale("en")).toBe(true);
      expect(isLocale("zh")).toBe(true);
    });

    it("非法值返回 false", () => {
      expect(isLocale("fr")).toBe(false);
      expect(isLocale("")).toBe(false);
      expect(isLocale(undefined)).toBe(false);
      expect(isLocale(null)).toBe(false);
    });
  });
});
