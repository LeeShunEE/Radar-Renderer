/**
 * 资源扩展名清单：前端过滤器的唯一声明源，防止与后端漂移。
 */

/** 音频扩展名。必须与 backend/app/api/v1/assets_router.py 的 _AUDIO_EXTS 保持一致 */
export const AUDIO_EXTS = ["mp3", "wav", "ogg", "m4a", "aac", "flac"] as const;
/** 图片扩展名。必须与 backend _IMAGE_EXTS 保持一致 */
export const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg"] as const;
/** 视频扩展名（backgrounds 专用，后端无对应清单） */
export const VIDEO_EXTS = ["mp4", "webm", "mov"] as const;

export const extRegex = (exts: readonly string[]): RegExp =>
  new RegExp(`\\.(${exts.join("|")})$`, "i");
