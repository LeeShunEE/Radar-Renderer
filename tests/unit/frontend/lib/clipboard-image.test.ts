/**
 * clipboard-image 工具单元测试：图片提取（files / items 两来源、非图片忽略）与命名。
 */
import { describe, it, expect } from "vitest";
import { extractPastedImage, pastedImageName } from "@/lib/clipboard-image";

const img = (name = "a.png", type = "image/png") => new File(["x"], name, { type });

function clipboard(opts: { files?: File[]; items?: unknown[] }): DataTransfer {
  return { files: opts.files ?? [], items: opts.items ?? [] } as unknown as DataTransfer;
}

describe("extractPastedImage", () => {
  it("从 files 提取图片", () => {
    const f = img();
    expect(extractPastedImage(clipboard({ files: [f] }))).toBe(f);
  });

  it("从 items（blob）提取图片", () => {
    const blob = img("image.png");
    const got = extractPastedImage(
      clipboard({ items: [{ kind: "file", type: "image/png", getAsFile: () => blob }] }),
    );
    expect(got).toBe(blob);
  });

  it("files 优先于 items", () => {
    const f = img("first.png");
    const blob = img("second.png");
    const got = extractPastedImage(
      clipboard({
        files: [f],
        items: [{ kind: "file", type: "image/png", getAsFile: () => blob }],
      }),
    );
    expect(got).toBe(f);
  });

  it("非图片返回 null", () => {
    const txt = new File(["t"], "note.txt", { type: "text/plain" });
    expect(extractPastedImage(clipboard({ files: [txt] }))).toBeNull();
  });

  it("clipboardData 为 null 返回 null", () => {
    expect(extractPastedImage(null)).toBeNull();
  });
});

describe("pastedImageName", () => {
  it("保留有意义的原文件名", () => {
    expect(pastedImageName(img("shot.png"))).toBe("shot.png");
  });

  it("无名截图 image.png 重命名为 pasted-<ts>.png", () => {
    expect(pastedImageName(img("image.png"))).toMatch(/^pasted-\d+\.png$/);
  });

  it("扩展名从 MIME 推断（jpeg）", () => {
    expect(pastedImageName(img("image.png", "image/jpeg"))).toMatch(/^pasted-\d+\.jpeg$/);
  });
});
