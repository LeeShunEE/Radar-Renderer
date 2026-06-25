import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { BackgroundAudio } from "@/remotion/Effects/BackgroundAudio";
import type { BackgroundMediaConfig } from "@/types/radar";

// Mock remotion Audio + staticFile + useVideoConfig（镜像 BackgroundMedia.test.tsx 的 mock 模式）
vi.mock("remotion", async (orig) => {
  const actual = await orig<typeof import("remotion")>();
  return {
    ...actual,
    Audio: (p: Record<string, unknown>) => (
      <audio
        data-testid="bg-audio"
        data-src={p.src as string}
        data-trimbefore={p.trimBefore as number}
        data-playbackrate={p.playbackRate as number}
        data-loop={String(p.loop)}
      />
    ),
    staticFile: (s: string) => `/static/${s}`,
    useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 300 }),
  };
});

const media = (over: Partial<BackgroundMediaConfig> = {}): BackgroundMediaConfig => ({
  src: "bg/x.mp4",
  opacity: 1,
  blur: 0,
  scale: "cover",
  position: "center",
  videoOptions: { loop: true, muted: false, playbackRate: 1, startFrom: 0 },
  ...over,
});

describe("BackgroundAudio", () => {
  it("muted=true 时不渲染（返回 null）", () => {
    const { container } = render(
      <BackgroundAudio media={media({ videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 } })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("未 muted + src 存在 → 渲染 Audio，trimBefore 换算正确", () => {
    // fps=30, startFrom=2000ms → trimBefore = Math.round(2000/1000*30) = 60
    const { getByTestId } = render(
      <BackgroundAudio
        media={media({
          src: "bg/c.mp4",
          videoOptions: { loop: true, muted: false, playbackRate: 2, startFrom: 2000 },
        })}
      />,
    );
    const audio = getByTestId("bg-audio");
    expect(audio.getAttribute("data-trimbefore")).toBe("60");
    expect(audio.getAttribute("data-playbackrate")).toBe("2");
    expect(audio.getAttribute("data-loop")).toBe("true");
  });

  it("空 src 不渲染", () => {
    const { container } = render(<BackgroundAudio media={media({ src: "" })} />);
    expect(container.firstChild).toBeNull();
  });

  it("相对路径 src → staticFile 应用（/static/ 前缀）", () => {
    const { getByTestId } = render(
      <BackgroundAudio media={media({ src: "videos/bg.mp4" })} />,
    );
    const audio = getByTestId("bg-audio");
    expect(audio.getAttribute("data-src")).toBe("/static/videos/bg.mp4");
  });

  it("远程 URL src → 原样透传（不加 staticFile）", () => {
    const remoteUrl = "https://example.com/bg.mp4";
    const { getByTestId } = render(
      <BackgroundAudio media={media({ src: remoteUrl })} />,
    );
    const audio = getByTestId("bg-audio");
    expect(audio.getAttribute("data-src")).toBe(remoteUrl);
  });

  it("blob URL src → 原样透传", () => {
    const blobUrl = "blob:http://localhost/some-uuid";
    const { getByTestId } = render(
      <BackgroundAudio media={media({ src: blobUrl })} />,
    );
    const audio = getByTestId("bg-audio");
    expect(audio.getAttribute("data-src")).toBe(blobUrl);
  });
});
