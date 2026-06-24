import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { BackgroundMedia } from "@/remotion/Effects/BackgroundMedia";
import type { BackgroundMediaConfig } from "@/types/radar";

// Remotion 的 Img/OffthreadVideo 在 jsdom 下需 mock 为简单标签
vi.mock("remotion", async (orig) => {
  const actual = await orig<typeof import("remotion")>();
  return {
    ...actual,
    Img: (p: Record<string, unknown>) => <img data-testid="bg-img" {...p} />,
    OffthreadVideo: (p: Record<string, unknown>) => (
      <video
        data-testid="bg-video"
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
  src: "bg/x.png", opacity: 0.5, blur: 4, scale: "contain", position: "top",
  videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 }, ...over,
});

describe("BackgroundMedia", () => {
  it("type=image 渲染 Img，应用 objectFit/position/opacity/blur", () => {
    const { getByTestId } = render(<BackgroundMedia type="image" media={media()} />);
    const img = getByTestId("bg-img") as HTMLImageElement;
    expect(img.style.objectFit).toBe("contain");
    expect(img.style.objectPosition).toBe("top");
    expect(img.style.opacity).toBe("0.5");
    expect(img.style.filter).toContain("blur(4px)");
  });

  it("type=video 渲染 OffthreadVideo，trimBefore 换算正确且 playbackRate 透传", () => {
    // useVideoConfig 已 mock fps=30；startFrom=2000ms → trimBefore = round(2000/1000*30) = 60
    const { getByTestId } = render(
      <BackgroundMedia
        type="video"
        media={media({ src: "bg/c.mp4", videoOptions: { loop: true, muted: true, playbackRate: 2, startFrom: 2000 } })}
      />,
    );
    const vid = getByTestId("bg-video");
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
    expect((getByTestId("bg-img") as HTMLImageElement).style.objectFit).toBe("fill");
  });

  it("blur=0 时图片无 filter 样式", () => {
    const { getByTestId } = render(<BackgroundMedia type="image" media={media({ blur: 0 })} />);
    const img = getByTestId("bg-img") as HTMLImageElement;
    expect(img.style.filter).toBe("");
  });
});
