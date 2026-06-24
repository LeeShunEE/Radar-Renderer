import type { BackgroundConfig } from "../../types/radar";

/**
 * 决定背景渲染走渐变还是媒体。
 *
 * 规则：type === "gradient"，或 media.src 为空/未定义 → "gradient"；
 * 否则 → "media"（由调用方渲染 BackgroundMedia + Vignette）。
 *
 * Args:
 *   background: BackgroundConfig，含 type 与可选 media
 *
 * Returns:
 *   "gradient" | "media"
 */
export function selectBackgroundKind(background: BackgroundConfig): "gradient" | "media" {
  return background.type === "gradient" || !background.media?.src ? "gradient" : "media";
}
