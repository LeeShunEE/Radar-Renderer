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
    OffthreadVideo: (p: Record<string, unknown>) => <video data-testid="bg-video" {...p} />,
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

  it("type=video 渲染 OffthreadVideo，传 loop/muted/playbackRate", () => {
    const { getByTestId } = render(<BackgroundMedia type="video" media={media({ src: "bg/c.mp4" })} />);
    expect(getByTestId("bg-video")).not.toBeNull();
  });

  it("空 src 不渲染", () => {
    const { container } = render(<BackgroundMedia type="image" media={media({ src: "" })} />);
    expect(container.firstChild).toBeNull();
  });

  it("scale=fill 映射 objectFit:fill", () => {
    const { getByTestId } = render(<BackgroundMedia type="image" media={media({ scale: "fill" })} />);
    expect((getByTestId("bg-img") as HTMLImageElement).style.objectFit).toBe("fill");
  });
});
