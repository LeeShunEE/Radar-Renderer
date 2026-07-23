/**
 * 语言切换的 server action：把用户所选 locale 写入 Cookie。
 *
 * 客户端语言切换器调用本 action 后，需自行 router.refresh() 触发重渲染，
 * 使 request.ts 读到新 Cookie。Cookie 非 httpOnly（无敏感信息），有效期 1 年。
 */
"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, type Locale } from "./config";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * 持久化用户所选语言。
 *
 * Args:
 *   locale: 目标语言，必须是受支持的 locale。
 *
 * Raises:
 *   Error: 传入非法 locale（防止写入越界值污染 Cookie）。
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });
}
