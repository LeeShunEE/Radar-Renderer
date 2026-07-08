/**
 * 背景视频上传软警告（决策 Q7）：仅提示，不拦截上传。
 *
 * Why 软警告而非硬拦：用户可能确有大视频/高分辨率的合理需求；
 * 渲染端用只读挂载零拷贝、预览端 blob，资源压力可控，故只提示风险（渲染慢/占用高），
 * 不剥夺用户选择权。
 */

/** 背景媒体类型（与 BackgroundConfig.type 的 image/video 对应）。 */
export type BackgroundMediaKind = "image" | "video";

const VIDEO_EXT_RE = /\.(mp4|webm|mov)$/i;
const IMAGE_EXT_RE = /\.(png|jpg|jpeg|gif|webp|svg)$/i;

/**
 * 按扩展名判断媒体 src 的类型（查询串/哈希不参与匹配）。
 *
 * Args:
 *   src: 媒体路径或 URL
 *
 * Returns:
 *   "image" | "video"，无法识别（如 blob: URL、空串）时返回 null
 */
export function mediaKindFromSrc(src: string): BackgroundMediaKind | null {
  const path = src.split(/[?#]/)[0];
  if (VIDEO_EXT_RE.test(path)) return "video";
  if (IMAGE_EXT_RE.test(path)) return "image";
  return null;
}

export const BG_VIDEO_SIZE_WARN_BYTES = 50 * 1024 * 1024; // 50MB
export const BG_VIDEO_MAX_WIDTH = 1920;
export const BG_VIDEO_MAX_HEIGHT = 1080;

export interface BackgroundVideoMeta {
  width: number;
  height: number;
  sizeBytes: number;
}

/** 返回警告文案数组；空数组表示无警告。边界值（恰好等于阈值）不警告。 */
export function checkBackgroundVideo(meta: BackgroundVideoMeta): string[] {
  const warnings: string[] = [];
  if (meta.sizeBytes > BG_VIDEO_SIZE_WARN_BYTES) {
    const mb = (meta.sizeBytes / (1024 * 1024)).toFixed(0);
    warnings.push(`视频体积较大（${mb}MB，建议 ≤50MB），渲染较慢且占用较高`);
  }
  if (meta.width > BG_VIDEO_MAX_WIDTH || meta.height > BG_VIDEO_MAX_HEIGHT) {
    warnings.push(`视频分辨率较高（${meta.width}×${meta.height}，建议 ≤1920×1080），渲染较慢`);
  }
  return warnings;
}
