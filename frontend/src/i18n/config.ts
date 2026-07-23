/**
 * i18n 静态配置：支持的语言集合、默认语言、Cookie 名。
 *
 * 采用 next-intl 的 no-i18n-routing 模式——locale 存 Cookie，不进 URL，
 * 因此本文件是 locale 相关常量的唯一真源，request/locale/中间无关。
 */

/** 全部支持的 locale。en 为默认（面向海外/开源用户）。 */
export const locales = ["en", "zh"] as const;

export type Locale = (typeof locales)[number];

/** 首次访问、Cookie 缺失或非法时回退到此。 */
export const defaultLocale: Locale = "en";

/** 存放用户所选 locale 的 Cookie 名（next-intl 约定）。 */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** 各 locale 的展示名（用于语言切换器）。 */
export const localeLabels: Record<Locale, string> = {
  en: "English",
  zh: "中文",
};

/**
 * 判定任意字符串是否为受支持的 locale（收窄类型）。
 *
 * Args:
 *   value: 待校验的原始字符串（可能来自 Cookie，不可信）。
 *
 * Returns:
 *   value 是否属于 locales。
 */
export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (locales as readonly string[]).includes(value);
}
