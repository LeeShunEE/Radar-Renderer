/**
 * ETA 倒计时文本显示。
 */
"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatEtaSeconds } from "@/lib/format";

interface TaskEtaDisplayProps {
  etaSeconds: number | null;
  position: number;
}

export function TaskEtaDisplay({ etaSeconds, position }: TaskEtaDisplayProps) {
  const t = useTranslations("tasks");
  const locale = useLocale() as "en" | "zh";

  if (etaSeconds === null || etaSeconds <= 0) {
    return null;
  }

  return (
    <span className="text-xs text-muted-foreground">
      {t("eta", { position, eta: formatEtaSeconds(etaSeconds, locale) })}
    </span>
  );
}