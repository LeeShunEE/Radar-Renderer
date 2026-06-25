/**
 * 媒体源解析与解码工具：为本地渲染管线提供音频数据。
 *
 * 与 MultiPageVideo.tsx / PreviewPanel.tsx 的 audioSrc 处理逻辑一致：
 * - 空/null → null
 * - http(s):// 开头 → 原样
 * - / 开头 → 原样（已是绝对路径）
 * - 相对路径 → 前置 /
 */

/**
 * 解析音乐 URL，统一处理相对/绝对/远程路径。
 *
 * @param musicUrl - 配置中的音乐路径（可能为空、相对、绝对或远程）
 * @returns 可直接用于 fetch 的 URL，或 null 表示无音乐
 */
export function resolveMusicUrl(musicUrl: string | null | undefined): string | null {
  if (!musicUrl) return null;
  // 远程 URL（http/https）原样返回
  if (musicUrl.startsWith("http://") || musicUrl.startsWith("https://")) {
    return musicUrl;
  }
  // 已是绝对路径（前导 /）原样返回
  if (musicUrl.startsWith("/")) {
    return musicUrl;
  }
  // 相对路径前置 /（与 PreviewPanel.tsx:467 一致）
  return `/${musicUrl}`;
}

/**
 * 拉取并解码音频文件为 AudioBuffer。
 *
 * @param url - 已解析的音乐 URL（resolveMusicUrl 的输出）
 * @returns 解码后的 AudioBuffer，或 null（加载/解码失败）
 */
export async function fetchAndDecodeAudio(url: string | null): Promise<AudioBuffer | null> {
  if (!url) return null;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`fetchAndDecodeAudio: fetch ${url} failed (${res.status})`);
      return null;
    }
    const buf = await res.arrayBuffer();

    // 使用 AudioContext 解码（兼容 webkitAudioContext）
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();

    try {
      const decoded = await ctx.decodeAudioData(buf.slice(0));
      void ctx.close();
      return decoded;
    } catch (decodeErr) {
      console.warn("fetchAndDecodeAudio: decodeAudioData failed", decodeErr);
      void ctx.close();
      return null;
    }
  } catch (err) {
    console.warn("fetchAndDecodeAudio: fetch/decode error", err);
    return null;
  }
}