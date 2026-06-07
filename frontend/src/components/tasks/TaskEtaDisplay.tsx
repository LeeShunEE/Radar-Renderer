/**
 * ETA 倒计时文本显示。
 */
"use client";

interface TaskEtaDisplayProps {
  etaSeconds: number | null;
  position: number;
}

export function TaskEtaDisplay({ etaSeconds, position }: TaskEtaDisplayProps) {
  if (etaSeconds === null || etaSeconds <= 0) {
    return null;
  }

  // 格式化时间
  const formatEta = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} 秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes} 分钟`;
    }
    return `${minutes} 分 ${remainingSeconds} 秒`;
  };

  return (
    <span className="text-xs text-muted-foreground">
      排队 #{position}，预计 {formatEta(etaSeconds)}
    </span>
  );
}