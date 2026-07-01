import { describe, it, expect, vi } from "vitest";
import { replaceUploadsInProps } from "@/lib/replace-uploads";

const URL = "http://x/api/v1/files/uploads/clip.mp4";

describe("replaceUploadsInProps", () => {
  it("替换 silhouetteSrc 与 background.media.src（任意 key）", () => {
    const cache: Record<string, string> = { "clip.mp4": "blob:abc", "hero.png": "blob:def" };
    const out = replaceUploadsInProps(
      { silhouetteSrc: "http://x/api/v1/files/uploads/hero.png",
        background: { media: { src: URL } } },
      (n) => cache[n], () => {},
    ) as any;
    expect(out.silhouetteSrc).toBe("blob:def");
    expect(out.background.media.src).toBe("blob:abc");
  });

  it("无缓存时保留原值并触发加载", () => {
    const trigger = vi.fn();
    const out = replaceUploadsInProps({ background: { media: { src: URL } } }, () => undefined, trigger) as any;
    expect(out.background.media.src).toBe(URL);
    expect(trigger).toHaveBeenCalledWith("clip.mp4");
  });

  it("非 uploads 字符串与原始对象不受影响", () => {
    const input = { silhouetteSrc: "silhouettes/builtin.png", name: "hero", theme: { backgroundColor: "#000" } };
    const out = replaceUploadsInProps(input, () => undefined, () => {}) as any;
    expect(out.silhouetteSrc).toBe("silhouettes/builtin.png");
    expect(out.name).toBe("hero");
    expect(out.theme.backgroundColor).toBe("#000");
    // 不修改原对象（深拷贝/新对象）
    expect(out).not.toBe(input);
  });

  it("数组内嵌套也被处理", () => {
    const cache: Record<string, string> = { "hero.png": "blob:def" };
    const out = replaceUploadsInProps(
      { pages: [{ silhouetteSrc: "http://x/api/v1/files/uploads/hero.png" }] },
      (n) => cache[n], () => {},
    ) as any;
    expect(out.pages[0].silhouetteSrc).toBe("blob:def");
  });
});
