/**
 * VideoPageConfigPanel 单元测试：素材/时长/色键/底衬控件 onChange 载荷。
 * AssetSelector/Slider/Switch/ColorPicker/Input/Label 内联 mock；
 * HTMLVideoElement 时长探测通过 spyOn(document, "createElement") 注入假 video。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VideoPageConfigPanel } from "@/components/editor/VideoPageConfigPanel";
import { defaultVideoPage, VIDEO_FPS } from "@/types/constants";
import type { VideoPageConfig } from "@/types/radar";

vi.mock("@/components/files/AssetSelector", () => ({
  AssetSelector: (p: any) => (
    <div>
      <div
        data-testid="asset-selector"
        data-media-kind={p.mediaKind}
        data-value={p.value}
      />
      <button data-testid="asset-pick" onClick={() => p.onChange("http://cdn/download/clip.mp4")}>
        pick
      </button>
      <button
        data-testid="asset-pick-upload"
        onClick={() => p.onChange("http://backend/api/v1/files/uploads/green.webm")}
      >
        pick-upload
      </button>
    </div>
  ),
}));
vi.mock("@/lib/api-client", () => ({
  files: { fetchUploadBlob: vi.fn() },
}));
vi.mock("@/components/ui/slider", () => ({
  Slider: ({ value, onValueChange, "data-testid": testId }: any) => (
    <input
      type="range"
      data-testid={testId ?? "slider"}
      min={-1}
      max={2}
      step={0.01}
      value={value?.[0] ?? 0}
      onChange={(e) => onValueChange?.(Number(e.target.value))}
    />
  ),
}));
vi.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, "data-testid": testId }: any) => (
    <button
      role="switch"
      data-testid={testId}
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
    />
  ),
}));
vi.mock("@/components/ui/color-picker", () => ({
  ColorPicker: ({ value, onChange }: any) => (
    <input
      type="text"
      data-testid="color-picker"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));
vi.mock("@/components/ui/input", () => ({
  Input: (p: any) => <input {...p} />,
}));
vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));

const makePage = (overrides: Partial<VideoPageConfig> = {}): VideoPageConfig => ({
  ...defaultVideoPage,
  ...overrides,
});

const lastCall = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![0];

// 色键详情控件仅在 chromaKey.enabled 时渲染，故详情测试用启用态 fixture
const makePageWithChroma = (overrides: Partial<VideoPageConfig> = {}): VideoPageConfig => ({
  ...defaultVideoPage,
  chromaKey: {
    enabled: true,
    keyColor: "#00ff00",
    similarity: 0.18,
    smoothness: 0.08,
    spillSuppression: 0.25,
  },
  ...overrides,
});

describe("VideoPageConfigPanel", () => {
  let onUpdate: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    onUpdate = vi.fn();
  });

  it("渲染素材选择器（mediaKind=video）", () => {
    render(<VideoPageConfigPanel page={makePage()} onUpdate={onUpdate} />);
    expect(screen.getByTestId("asset-selector").getAttribute("data-media-kind")).toBe("video");
  });

  it("label 改动 → onUpdate({ label })", () => {
    render(<VideoPageConfigPanel page={makePage()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByTestId("vp-label"), { target: { value: "新视频" } });
    expect(onUpdate).toHaveBeenCalledWith({ label: "新视频" });
  });

  it("durationInFrames 数字输入 → onUpdate({ durationInFrames })", () => {
    render(<VideoPageConfigPanel page={makePage()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByTestId("vp-duration"), { target: { value: "300" } });
    expect(onUpdate).toHaveBeenCalledWith({ durationInFrames: 300 });
  });

  it("fit 选 cover → onUpdate({ fit: 'cover' })", () => {
    render(<VideoPageConfigPanel page={makePage()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTestId("vp-fit-cover"));
    expect(onUpdate).toHaveBeenCalledWith({ fit: "cover" });
  });

  it("audio.muted 开关 → onUpdate({ audio: { muted: true } })", () => {
    render(<VideoPageConfigPanel page={makePage()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTestId("vp-audio-muted"));
    expect(onUpdate).toHaveBeenCalledWith({ audio: { muted: true } });
  });

  it("audio.volume 滑杆 → onUpdate({ audio: { volume } })", () => {
    render(<VideoPageConfigPanel page={makePage()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByTestId("vp-volume"), { target: { value: "0.5" } });
    expect(onUpdate).toHaveBeenCalledWith({ audio: { volume: 0.5 } });
  });

  it("色键 enabled 开关 → onUpdate({ chromaKey: { enabled: true } })", () => {
    render(<VideoPageConfigPanel page={makePage()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTestId("vp-chroma-enabled"));
    expect(onUpdate).toHaveBeenCalledWith({ chromaKey: { enabled: true } });
  });

  it("绿幕预设 → onUpdate({ chromaKey: { keyColor: '#00ff00' } })", () => {
    render(<VideoPageConfigPanel page={makePageWithChroma()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTestId("vp-preset-green"));
    expect(onUpdate).toHaveBeenCalledWith({ chromaKey: { keyColor: "#00ff00" } });
  });

  it("蓝幕预设 → onUpdate({ chromaKey: { keyColor: '#0000ff' } })", () => {
    render(<VideoPageConfigPanel page={makePageWithChroma()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTestId("vp-preset-blue"));
    expect(onUpdate).toHaveBeenCalledWith({ chromaKey: { keyColor: "#0000ff" } });
  });

  it("自定义色键 ColorPicker → onUpdate({ chromaKey: { keyColor } })", () => {
    render(<VideoPageConfigPanel page={makePageWithChroma()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByTestId("color-picker"), { target: { value: "#abcdef" } });
    expect(onUpdate).toHaveBeenCalledWith({ chromaKey: { keyColor: "#abcdef" } });
  });

  it("色键 similarity 滑杆 → onUpdate({ chromaKey: { similarity } })", () => {
    render(<VideoPageConfigPanel page={makePageWithChroma()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByTestId("vp-similarity"), { target: { value: "0.4" } });
    expect(onUpdate).toHaveBeenCalledWith({ chromaKey: { similarity: 0.4 } });
  });

  it("色键 smoothness 滑杆 → onUpdate({ chromaKey: { smoothness } })", () => {
    render(<VideoPageConfigPanel page={makePageWithChroma()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByTestId("vp-smoothness"), { target: { value: "0.3" } });
    expect(onUpdate).toHaveBeenCalledWith({ chromaKey: { smoothness: 0.3 } });
  });

  it("色键 spillSuppression 滑杆 → onUpdate({ chromaKey: { spillSuppression } })", () => {
    render(<VideoPageConfigPanel page={makePageWithChroma()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByTestId("vp-spill"), { target: { value: "0.6" } });
    expect(onUpdate).toHaveBeenCalledWith({ chromaKey: { spillSuppression: 0.6 } });
  });

  it("底衬切到图片 → onUpdate background.type=image", () => {
    render(<VideoPageConfigPanel page={makePage()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText("图片"));
    expect(lastCall(onUpdate).background?.type).toBe("image");
  });

  describe("时长探测", () => {
    let spy: ReturnType<typeof vi.spyOn>;
    afterEach(() => spy?.mockRestore());

    const mountFakeVideo = (duration: number | null) => {
      const fakeVideo: any = {
        preload: "",
        currentTime: 0,
        onloadedmetadata: null,
        ontimeupdate: null,
        onerror: null,
      };
      if (duration !== null) fakeVideo.duration = duration;
      Object.defineProperty(fakeVideo, "src", {
        set() {
          queueMicrotask(() => {
            if (duration === null) fakeVideo.onerror?.();
            else fakeVideo.onloadedmetadata?.();
          });
        },
      });
      const original = document.createElement.bind(document);
      spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) =>
        tag === "video" ? fakeVideo : original(tag),
      );
    };

    it("选中素材后探测 duration 回填 durationInFrames", async () => {
      mountFakeVideo(10.5);
      render(<VideoPageConfigPanel page={makePage()} onUpdate={onUpdate} />);
      fireEvent.click(screen.getByTestId("asset-pick"));
      expect(onUpdate).toHaveBeenCalledWith({ src: "http://cdn/download/clip.mp4" });
      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith({
          durationInFrames: Math.round(10.5 * VIDEO_FPS),
        });
      });
    });

    it("uploads URL 经鉴权 blob 拉取后探测（裸 <video src> 会 401）", async () => {
      const { files } = await import("@/lib/api-client");
      vi.mocked(files.fetchUploadBlob).mockResolvedValue(new Blob(["x"]));
      const createSpy = vi.fn(() => "blob:probe-url");
      const revokeSpy = vi.fn();
      URL.createObjectURL = createSpy as any;
      URL.revokeObjectURL = revokeSpy as any;

      mountFakeVideo(2);
      render(<VideoPageConfigPanel page={makePage()} onUpdate={onUpdate} />);
      fireEvent.click(screen.getByTestId("asset-pick-upload"));
      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith({
          durationInFrames: Math.round(2 * VIDEO_FPS),
        });
      });
      expect(files.fetchUploadBlob).toHaveBeenCalledWith("green.webm");
      expect(createSpy).toHaveBeenCalled();
      expect(revokeSpy).toHaveBeenCalledWith("blob:probe-url");
    });

    it("uploads blob 拉取失败不回填 durationInFrames", async () => {
      const { files } = await import("@/lib/api-client");
      vi.mocked(files.fetchUploadBlob).mockRejectedValue(new Error("401"));
      mountFakeVideo(2);
      render(<VideoPageConfigPanel page={makePage()} onUpdate={onUpdate} />);
      fireEvent.click(screen.getByTestId("asset-pick-upload"));
      await new Promise((r) => setTimeout(r, 30));
      expect(onUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({ durationInFrames: expect.anything() }),
      );
    });

    it("探测失败（onerror）不回填 durationInFrames", async () => {
      mountFakeVideo(null);
      render(<VideoPageConfigPanel page={makePage({ durationInFrames: 150 })} onUpdate={onUpdate} />);
      fireEvent.click(screen.getByTestId("asset-pick"));
      expect(onUpdate).toHaveBeenCalledWith({ src: "http://cdn/download/clip.mp4" });
      await waitFor(() => expect(spy).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 30));
      expect(onUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({ durationInFrames: expect.anything() }),
      );
    });
  });
});
