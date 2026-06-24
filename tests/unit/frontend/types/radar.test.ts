import { describe, it, expect } from "vitest";
import { RadarVideoSchema, BackgroundSchema, defaultBackground } from "@/types/radar";
import { makePage } from "../components/editor/_fixtures";

describe("BackgroundSchema", () => {
  it("默认回落 gradient", () => {
    const parsed = BackgroundSchema.parse(undefined);
    expect(parsed.type).toBe("gradient");
    expect(parsed.media).toBeUndefined();
  });

  it("解析完整 media 配置", () => {
    const parsed = BackgroundSchema.parse({
      type: "video",
      media: {
        src: "bg/clip.mp4",
        opacity: 0.8,
        blur: 4,
        scale: "cover",
        position: "center",
        videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 },
      },
    });
    expect(parsed.type).toBe("video");
    expect(parsed.media?.scale).toBe("cover");
    expect(parsed.media?.videoOptions?.loop).toBe(true);
  });

  it("media 各字段有默认值", () => {
    const parsed = BackgroundSchema.parse({ type: "image", media: { src: "bg/x.png" } });
    expect(parsed.media?.opacity).toBe(1);
    expect(parsed.media?.blur).toBe(0);
    expect(parsed.media?.scale).toBe("cover");
    expect(parsed.media?.position).toBe("center");
  });
});

describe("RadarVideoSchema background 兼容", () => {
  it("旧配置（无 background）解析后回落 gradient", () => {
    const legacy = makePage(); // 不含 background 字段的合法 props
    // @ts-expect-error 故意删除以模拟旧数据
    delete legacy.background;
    const parsed = RadarVideoSchema.parse(legacy);
    expect(parsed.background.type).toBe("gradient");
  });
});

describe("defaultBackground", () => {
  it("defaultBackground 是 gradient 类型", () => {
    expect(defaultBackground.type).toBe("gradient");
  });
});
