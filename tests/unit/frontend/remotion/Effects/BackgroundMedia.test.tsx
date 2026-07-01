import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { BackgroundMedia } from "@/remotion/Effects/BackgroundMedia";
import type { BackgroundMediaConfig } from "@/types/radar";

// vi.hoisted 保证 env 在 vi.mock 工厂闭包执行前已就绪，可在用例间切换渲染/预览分支。
const env = vi.hoisted(() => ({ isRendering: false }));

// Remotion 的 Img/OffthreadVideo 在 jsdom 下需 mock 为简单标签。
// 透传组件传入的 props（含真实 data-testid，供 e2e/单测共用同一标识）。
vi.mock("remotion", async (orig) => {
  const actual = await orig<typeof import("remotion")>();
  return {
    ...actual,
    Img: (p: Record<string, unknown>) => <img {...p} />,
    OffthreadVideo: (p: Record<string, unknown>) => (
      <video
        data-testid={p["data-testid"] as string}
        data-trimbefore={p.trimBefore as number}
        data-playbackrate={p.playbackRate as number}
        style={p.style as React.CSSProperties}
      />
    ),
    staticFile: (s: string) => `/static/${s}`,
    useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 300 }),
    useRemotionEnvironment: () => ({ isRendering: env.isRendering }),
  };
});

// Mock @remotion/media 的 Video 组件（渲染时使用）。
// 用同步工厂且不加载真实模块：真实 Video 依赖 Composition 上下文（useVideoConfig），
// 在 jsdom 单测中会抛 "No video config found"，故仅提供透传 props 的标签替身。
vi.mock("@remotion/media", () => ({
  Video: (p: Record<string, unknown>) => (
    <video
      data-testid={p["data-testid"] as string}
      data-trimbefore={p.trimBefore as number}
      data-playbackrate={p.playbackRate as number}
      data-loop={String(p.loop)}
      style={p.style as React.CSSProperties}
    />
  ),
}));

const media = (over: Partial<BackgroundMediaConfig> = {}): BackgroundMediaConfig => ({
  src: "bg/x.png", opacity: 0.5, blur: 4, scale: "contain", position: "top",
  videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 }, ...over,
});

describe("BackgroundMedia", () => {
  it("type=image 渲染 Img，应用 objectFit/position/opacity/blur", () => {
    const { getByTestId } = render(<BackgroundMedia type="image" media={media()} />);
    const img = getByTestId("background-media-image") as HTMLImageElement;
    expect(img.style.objectFit).toBe("contain");
    expect(img.style.objectPosition).toBe("top");
    expect(img.style.opacity).toBe("0.5");
    expect(img.style.filter).toContain("blur(4px)");
  });

  it("type=video 渲染 OffthreadVideo（预览模式），trimBefore 换算正确且 playbackRate 透传", () => {
    env.isRendering = false;
    // useVideoConfig 已 mock fps=30；startFrom=2000ms → trimBefore = round(2000/1000*30) = 60
    const { getByTestId } = render(
      <BackgroundMedia
        type="video"
        media={media({ src: "bg/c.mp4", videoOptions: { loop: true, muted: true, playbackRate: 2, startFrom: 2000 } })}
      />,
    );
    const vid = getByTestId("background-media-video");
    // 预览模式使用 OffthreadVideo（trimBefore prop，不支持 loop）
    expect(vid.getAttribute("data-trimbefore")).toBe("60");
    expect(vid.getAttribute("data-playbackrate")).toBe("2");
    expect(vid.getAttribute("data-loop")).toBeNull();
  });

  it("type=video 渲染 @remotion/media Video（渲染模式），trimBefore 换算正确且 loop/playbackRate 透传", () => {
    env.isRendering = true;
    // 同一 fixture：startFrom=2000ms → trimBefore = 60；loop=true；playbackRate=2
    const { getByTestId } = render(
      <BackgroundMedia
        type="video"
        media={media({ src: "bg/c.mp4", videoOptions: { loop: true, muted: true, playbackRate: 2, startFrom: 2000 } })}
      />,
    );
    const vid = getByTestId("background-media-video");
    // 渲染模式使用 @remotion/media 的 Video（trimBefore prop，支持 loop）
    expect(vid.getAttribute("data-trimbefore")).toBe("60");
    expect(vid.getAttribute("data-playbackrate")).toBe("2");
    expect(vid.getAttribute("data-loop")).toBe("true");
  });

  it("空 src 不渲染", () => {
    const { container } = render(<BackgroundMedia type="image" media={media({ src: "" })} />);
    expect(container.firstChild).toBeNull();
  });

  it("scale=fill 映射 objectFit:fill", () => {
    const { getByTestId } = render(<BackgroundMedia type="image" media={media({ scale: "fill" })} />);
    expect((getByTestId("background-media-image") as HTMLImageElement).style.objectFit).toBe("fill");
  });

  it("blur=0 时图片无 filter 样式", () => {
    const { getByTestId } = render(<BackgroundMedia type="image" media={media({ blur: 0 })} />);
    const img = getByTestId("background-media-image") as HTMLImageElement;
    expect(img.style.filter).toBe("");
  });
});
