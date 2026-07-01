/**
 * 剪贴板图片提取工具：从 paste 事件的 DataTransfer 中取出图片文件，
 * 并为无名截图生成带时间戳的文件名。供文件管理面板与资源选择器复用。
 */

/** 从剪贴板事件中提取首个图片 File（截图 blob 或复制的图片文件均可）。 */
export function extractPastedImage(clipboard: DataTransfer | null): File | null {
  if (!clipboard) return null;
  // 优先走 files（从文件系统复制图片时可用）
  for (const file of Array.from(clipboard.files)) {
    if (file.type.startsWith("image/")) return file;
  }
  // 再走 items（截图软件常见的 blob 数据）
  for (const item of Array.from(clipboard.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

/** 为无名的粘贴图片生成带时间戳的文件名，扩展名从 MIME 推断。 */
export function pastedImageName(file: File): string {
  if (file.name && file.name !== "image.png") return file.name;
  const ext = file.type.split("/")[1] || "png";
  return `pasted-${Date.now()}.${ext}`;
}
