import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { VideoPage } from "@/remotion/VideoPage";
import { defaultVideoPage } from "@/types/constants";
import type { VideoPageConfig } from "@/types/radar";

// vi.hoisted 保证 env 在 vi.mock 工厂闭包执行前已就绪，可在用例间切换渲染/预览分支。
const env = vi.hoisted(() => ({ isRendering: false }));

vi.mock("remotion", async (orig) => {
  const actual = await orig<typeof import("remotion")>();
  return {
    ...actual,
    OffthreadVideo: (p: Record<string, unknown>) => (
      <video
        data-testid={p["data-testid"] as string}
        data-kind="offthread"
        data-muted={String(p.muted)}
        data-volume={typeof p.volume === "function" ? (p.volume as (frame: number) => number)(0) : (p.volume as number)}
        style={p.style as React.CSSProperties}
      />
    ),
    staticFile: (s: string) => `/static/${s}`,
    useRemotionEnvironment: () => ({ isRendering: env.isRendering }),
  };
});

// @remotion/media 的 Video：真实组件依赖 Composition 上下文，jsdom 下 mock 为透传标签。
vi.mock("@remotion/media", () => ({
  Video: (p: Record<string, unknown>) => (
    <video
      data-testid={p["data-testid"] as string}
      data-kind="media"
      data-muted={String(p.muted)}
      data-volume={typeof p.volume === "function" ? (p.volume as (frame: number) => number)(0) : (p.volume as number)}
      data-effects={JSON.stringify(p.effects ?? null)}
      style={p.style as React.CSSProperties}
    />
  ),
}));

vi.mock("@remotion/effects/color-key", () => ({
  colorKey: vi.fn((opts: Record<string, unknown>) => ({ __effect: "colorKey", ...opts })),
}));

// BackgroundMedia 依赖 useVideoConfig 等上下文，替换为标识标签只断言分发。
vi.mock("@/remotion/Effects/BackgroundMedia", () => ({
  BackgroundMedia: (p: Record<string, unknown>) => (
    <div data-testid="background-media" data-type={p.type as string} />
  ),
}));

import { colorKey } from "@remotion/effects/color-key";

function makeVideoPage(overrides: Partial<VideoPageConfig> = {}): VideoPageConfig {
  return { ...defaultVideoPage, src: "uploads/a.mp4", ...overrides };
}

describe("VideoPage", () => {
  it("src 为空时不渲染视频", () => {
    const { queryByTestId } = render(<VideoPage page={makeVideoPage({ src: "" })} />);
    expect(queryByTestId("video-page-video")).toBeNull();
  });

  it("色键关闭 + 预览环境使用 OffthreadVideo（无 effects）", () => {
    env.isRendering = false;
    const { getByTestId } = render(<VideoPage page={makeVideoPage()} />);
    const vid = getByTestId("video-page-video");
    expect(vid.getAttribute("data-kind")).toBe("offthread");
  });

  it("色键关闭 + 渲染环境使用 @remotion/media Video（无 effects）", () => {
    env.isRendering = true;
    const { getByTestId } = render(<VideoPage page={makeVideoPage()} />);
    const vid = getByTestId("video-page-video");
    expect(vid.getAttribute("data-kind")).toBe("media");
    expect(vid.getAttribute("data-effects")).toBe("null");
    env.isRendering = false;
  });

  it("色键开启时预览也走 @remotion/media Video 且传入 colorKey effects", () => {
    env.isRendering = false;
    vi.mocked(colorKey).mockClear();
    const { getByTestId } = render(
      <VideoPage
        page={makeVideoPage({
          chromaKey: {
            enabled: true,
            keyColor: "#0000ff",
            similarity: 0.3,
            smoothness: 0.1,
            spillSuppression: 0.5,
          },
        })}
      />,
    );
    const vid = getByTestId("video-page-video");
    expect(vid.getAttribute("data-kind")).toBe("media");
    expect(colorKey).toHaveBeenCalledWith({
      keyColor: "#0000ff",
      similarity: 0.3,
      smoothness: 0.1,
      spillSuppression: 0.5,
    });
    const effects = JSON.parse(vid.getAttribute("data-effects")!);
    expect(effects).toEqual([
      { __effect: "colorKey", keyColor: "#0000ff", similarity: 0.3, smoothness: 0.1, spillSuppression: 0.5 },
    ]);
  });

  it("audio.muted/volume 透传（两个分支）", () => {
    env.isRendering = false;
    const page = makeVideoPage({ audio: { muted: true, volume: 0.4 } });
    const preview = render(<VideoPage page={page} />);
    const previewVid = preview.getByTestId("video-page-video");
    expect(previewVid.getAttribute("data-muted")).toBe("true");
    expect(previewVid.getAttribute("data-volume")).toBe("0.4");
    preview.unmount();

    const withKey = render(
      <VideoPage page={makeVideoPage({ audio: { muted: true, volume: 0.4 }, chromaKey: { ...page.chromaKey, enabled: true } })} />,
    );
    const keyVid = withKey.getByTestId("video-page-video");
    expect(keyVid.getAttribute("data-muted")).toBe("true");
    expect(keyVid.getAttribute("data-volume")).toBe("0.4");
  });

  it("fit 映射 objectFit", () => {
    const { getByTestId } = render(<VideoPage page={makeVideoPage({ fit: "cover" })} />);
    expect((getByTestId("video-page-video") as HTMLVideoElement).style.objectFit).toBe("cover");
  });

  it("底衬背景按 background.type 分发：gradient 无 BackgroundMedia", () => {
    const { queryByTestId } = render(<VideoPage page={makeVideoPage()} />);
    expect(queryByTestId("background-media")).toBeNull();
  });

  it("底衬背景按 background.type 分发：video 渲染 BackgroundMedia", () => {
    const { getByTestId } = render(
      <VideoPage
        page={makeVideoPage({
          background: {
            type: "video",
            media: {
              src: "bg/b.mp4",
              opacity: 1,
              blur: 0,
              scale: "cover",
              position: "center",
              videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 },
            },
          },
        })}
      />,
    );
    expect(getByTestId("background-media").getAttribute("data-type")).toBe("video");
  });

  it("远程/uploads src 原样使用，相对路径走 staticFile", () => {
    const remote = render(<VideoPage page={makeVideoPage({ src: "/api/v1/files/uploads/a.mp4", chromaKey: { ...defaultVideoPage.chromaKey, enabled: true } })} />);
    expect(remote.getByTestId("video-page-video")).toBeTruthy();
  });
});
