/**
 * LanguageSwitcher：在受支持的 locale 间切换。
 *
 * 点击后调用 setLocale server action 写 Cookie，再 router.refresh() 触发
 * 服务端按新 Cookie 重解析 messages 并重渲染（no-i18n-routing 模式，URL 不变）。
 */
"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import { setLocale } from "@/i18n/locale";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const active = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleSelect = (locale: Locale) => {
    if (locale === active || pending) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  };

  return (
    <div
      className={cn("flex items-center gap-1 text-xs", className)}
      data-testid="language-switcher"
    >
      <Languages className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      {locales.map((locale) => {
        const isActive = locale === active;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-pressed={isActive}
            disabled={pending}
            onClick={() => handleSelect(locale)}
            className={cn(
              "rounded px-1.5 py-0.5 transition-colors disabled:opacity-50",
              isActive
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {localeLabels[locale]}
          </button>
        );
      })}
    </div>
  );
}
