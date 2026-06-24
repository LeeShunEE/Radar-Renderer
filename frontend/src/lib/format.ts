/**
 * 通用格式化工具。
 */

/**
 * 把剩余秒数格式化为中文时间文案。
 *
 * 小数秒先取整（ETA 来自后端估算，亚秒精度无意义）：
 *   <60s → "N 秒"；整分 → "N 分钟"；分+秒 → "N 分 M 秒"。
 */
export function formatEtaSeconds(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) {
    return `${total} 秒`;
  }
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;
  if (remainingSeconds === 0) {
    return `${minutes} 分钟`;
  }
  return `${minutes} 分 ${remainingSeconds} 秒`;
}
