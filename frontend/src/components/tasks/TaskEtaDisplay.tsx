/**
 * ETA 倒计时文本显示。
 */
"use client";

import { formatEtaSeconds } from "@/lib/format";

interface TaskEtaDisplayProps {
  etaSeconds: number | null;
  position: number;
}

export function TaskEtaDisplay({ etaSeconds, position }: TaskEtaDisplayProps) {
  if (etaSeconds === null || etaSeconds <= 0) {
    return null;
  }

  return (
    <span className="text-xs text-muted-foreground">
      排队 #{position}，预计 {formatEtaSeconds(etaSeconds)}
    </span>
  );
}