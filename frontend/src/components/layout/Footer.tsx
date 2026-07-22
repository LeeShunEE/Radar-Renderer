/**
 * 应用页脚：展示当前构建版本号（git describe --tags --always --dirty）。
 * 版本号在 build 时由 next.config.js 的 env 注入，process.env.NEXT_PUBLIC_APP_VERSION
 * 被静态替换为字面量。空值兜底 "unknown"。
 */
"use client";

import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "unknown";
  return (
    <footer className="border-t border-unfocused-border-color px-6 py-2 text-center">
      <span className="text-xs text-muted-foreground">
        {t("version", { version })}
      </span>
    </footer>
  );
}
