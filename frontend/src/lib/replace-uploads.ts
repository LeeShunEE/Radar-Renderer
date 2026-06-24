/**
 * 预览侧 uploads URL 鉴权 blob 化工具。
 *
 * 背景：Remotion Player 在浏览器中渲染时需要访问用户上传的媒体文件
 * （剪影图片、背景图片/视频等），而这些文件位于需要鉴权的 `/api/v1/files/uploads/`
 * 端点下。浏览器无法在 <img>/<video> 中自动携带认证 header，因此在传给
 * Player 之前，需将所有 uploads URL 替换为通过 fetch+Authorization 拿到的
 * objectURL（blob:...）。
 *
 * 本函数从 PreviewPanel 的 silhouetteSrc 专用逻辑泛化而来，现覆盖任意 key
 * 下的 string 值（包括 background.media.src 等背景媒体字段），与后端渲染侧
 * Task 3.1 的按值匹配逻辑保持一致。
 */

/** 匹配 uploads 文件 URL 的正则，捕获文件名部分。 */
const UPLOADS_URL_PATTERN = /\/api\/v1\/files\/uploads\/([^/?#]+)$/;

/**
 * 递归遍历 `obj`，将所有匹配 uploads URL 的 string 值替换为鉴权 objectURL。
 *
 * - 若 `getCachedUrl(name)` 返回缓存的 blob URL，则使用它。
 * - 若未缓存，调用 `triggerLoad(name)` 触发异步加载，并暂时保留原值；
 *   缓存更新后调用方（如 useMemo）将重算并获得新值。
 * - 不匹配的字符串、数字、布尔等原始值原样返回。
 * - 返回新的对象/数组，不修改输入。
 *
 * @param obj - 待处理的任意值（通常为 inputProps 对象）
 * @param getCachedUrl - 根据文件名返回已缓存的 blob URL，未缓存时返回 undefined
 * @param triggerLoad - 触发指定文件名的异步加载
 * @returns 替换后的新值（与 obj 结构相同）
 */
export function replaceUploadsInProps(
  obj: unknown,
  getCachedUrl: (name: string) => string | undefined,
  triggerLoad: (name: string) => void,
): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item) => replaceUploadsInProps(item, getCachedUrl, triggerLoad));
  }

  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === "string") {
        const m = UPLOADS_URL_PATTERN.exec(v);
        if (m) {
          const name = decodeURIComponent(m[1]);
          const cached = getCachedUrl(name);
          if (cached !== undefined) {
            out[k] = cached;
          } else {
            // 触发异步加载；下次缓存更新时调用方 useMemo 会重算
            triggerLoad(name);
            out[k] = v; // 暂时保留原值
          }
          continue;
        }
      }
      out[k] = replaceUploadsInProps(v, getCachedUrl, triggerLoad);
    }
    return out;
  }

  return obj;
}
