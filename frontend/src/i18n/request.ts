/**
 * next-intl 请求级配置：从 Cookie 解析当前 locale 并加载对应 messages。
 *
 * no-i18n-routing 模式下没有 middleware / [locale] 路由段，因此这里必须显式
 * 返回 locale（缺失/非法回退 defaultLocale），否则 next-intl 会因“找不到 locale”
 * 报错。messages 按 locale 动态 import，仅打包命中的语言包。
 */
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE } from "./config";

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return { locale, messages };
});
