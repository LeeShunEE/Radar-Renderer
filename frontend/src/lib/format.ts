/**
 * 通用格式化工具。
 */

type EtaLocale = "en" | "zh";

/**
 * 把剩余秒数格式化为本地化时间文案。
 *
 * 纯函数（无 hook）故不能用 next-intl；由调用方传入 useLocale() 结果，默认 en。
 * 小数秒先取整（ETA 来自后端估算，亚秒精度无意义）：
 *   zh：<60s → "N 秒"；整分 → "N 分钟"；分+秒 → "N 分 M 秒"。
 *   en：<60s → "Ns"；整分 → "N min"；分+秒 → "Nm Ms"。
 */
export function formatEtaSeconds(seconds: number, locale: EtaLocale = "en"): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;
  if (locale === "zh") {
    if (total < 60) return `${total} 秒`;
    if (remainingSeconds === 0) return `${minutes} 分钟`;
    return `${minutes} 分 ${remainingSeconds} 秒`;
  }
  if (total < 60) return `${total}s`;
  if (remainingSeconds === 0) return `${minutes} min`;
  return `${minutes}m ${remainingSeconds}s`;
}
