/**
 * BackgroundConfigPanel 单元测试：
 * - 三态类型切换（gradient/image/video）
 * - 媒体控件（AssetSelector/opacity/blur/scale/position）仅 type≠gradient 时显示
 * - video 专属控件（loop/playbackRate）仅 type=video 时显示
 * - 暗角效果控件（vignette）写入 theme
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BackgroundConfigPanel } from "@/components/editor/BackgroundConfigPanel";
import type { BackgroundConfig, RadarTheme } from "@/types/radar";
import { baseTheme } from "./_fixtures";

// AssetSelector 有重 hook 依赖，stub 掉
vi.mock("@/components/files/AssetSelector", () => ({
  AssetSelector: (p: any) => (
    <div data-testid="asset-selector" data-category={p.category} />
  ),
}));

// Slider、Switch、Label mock（与 ThemeEditor.test.tsx 保持一致）
const h = vi.hoisted(() => ({ sliderPassesArray: true }));

vi.mock("@/components/ui/slider", () => ({
  Slider: ({ value, onValueChange, "data-testid": testId }: any) => (
    <input
      type="range"
      data-testid={testId ?? "slider"}
      min={-100000}
      max={100000}
      value={value?.[0] ?? 0}
      onChange={(e) =>
        onValueChange?.(
          h.sliderPassesArray ? [Number(e.target.value)] : Number(e.target.value),
        )
      }
    />
  ),
}));
vi.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, "data-testid": testId }: any) => (
    <button
      role="switch"
      data-testid={testId ?? "switch"}
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
    />
  ),
}));
vi.mock("@/components/ui/label", () => ({
  Label: ({ children, className }: any) => (
    <label className={className}>{children}</label>
  ),
}));
vi.mock("@/components/ui/separator", () => ({ Separator: () => null }));

// ── helpers ──────────────────────────────────────────────────────────────────

function makeBackground(overrides: Partial<BackgroundConfig> = {}): BackgroundConfig {
  return { type: "gradient", ...overrides };
}

function makeTheme(overrides: Partial<RadarTheme> = {}): RadarTheme {
  return { ...baseTheme, ...overrides };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("BackgroundConfigPanel", () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  // ── 类型切换 ─────────────────────────────────────────────────────────────

  it("渲染三个类型切换按钮（渐变/图片/视频）", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground()}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    expect(screen.getByText(/渐变/)).toBeInTheDocument();
    expect(screen.getByText(/图片/)).toBeInTheDocument();
    expect(screen.getByText(/视频/)).toBeInTheDocument();
  });

  it("点击「图片」按钮 → onChange 收到 background.type=image 且 media 已初始化", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({ type: "gradient" })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText(/图片/));
    expect(onChange).toHaveBeenCalled();
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.background?.type).toBe("image");
    expect(call.background?.media).toBeDefined();
    expect(typeof call.background?.media?.opacity).toBe("number");
  });

  it("点击「视频」按钮 → onChange 收到 background.type=video 且 media 已初始化", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({ type: "gradient" })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText(/视频/));
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.background?.type).toBe("video");
    expect(call.background?.media).toBeDefined();
  });

  it("点击「渐变」按钮 → onChange 收到 background.type=gradient", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({ type: "image", media: { src: "bg.jpg", opacity: 0.8, blur: 0, scale: "cover", position: "center", videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 } } })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText(/渐变/));
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.background?.type).toBe("gradient");
  });

  // ── gradient 时不显示媒体控件 ────────────────────────────────────────────

  it("type=gradient 时不渲染 AssetSelector 和媒体控件", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({ type: "gradient" })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    expect(screen.queryByTestId("asset-selector")).toBeNull();
    expect(screen.queryByText(/不透明度/)).toBeNull();
    expect(screen.queryByText(/模糊/)).toBeNull();
  });

  // ── image 时显示媒体控件、不显示视频专属控件 ────────────────────────────

  it("type=image 时显示 AssetSelector(category=backgrounds)、opacity/blur/scale/position 控件", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({
          type: "image",
          media: { src: "", opacity: 1, blur: 0, scale: "cover", position: "center", videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 } },
        })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    const sel = screen.getByTestId("asset-selector");
    expect(sel).toBeInTheDocument();
    expect(sel.getAttribute("data-category")).toBe("backgrounds");
    expect(screen.getByText(/不透明度/)).toBeInTheDocument();
    expect(screen.getByText(/模糊/)).toBeInTheDocument();
    // scale 按钮组
    expect(screen.getByText(/cover/i)).toBeInTheDocument();
    // position 按钮组
    expect(screen.getByText(/center/i)).toBeInTheDocument();
  });

  it("type=image 时不显示视频专属控件（循环/速率）", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({
          type: "image",
          media: { src: "", opacity: 1, blur: 0, scale: "cover", position: "center", videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 } },
        })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    expect(screen.queryByText(/循环/)).toBeNull();
    expect(screen.queryByText(/播放速率/)).toBeNull();
  });

  // ── video 时显示所有媒体控件 + 视频专属控件 ──────────────────────────────

  it("type=video 时额外显示循环 Switch 和播放速率 Slider", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({
          type: "video",
          media: { src: "", opacity: 1, blur: 0, scale: "cover", position: "center", videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 } },
        })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    expect(screen.getByText(/循环/)).toBeInTheDocument();
    expect(screen.getByText(/播放速率/)).toBeInTheDocument();
    expect(screen.getByTestId("asset-selector")).toBeInTheDocument();
  });

  // ── opacity slider 写入 background.media.opacity ─────────────────────────

  it("拖动 opacity slider → onChange 收到 background.media.opacity 更新", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({
          type: "image",
          media: { src: "", opacity: 1, blur: 0, scale: "cover", position: "center", videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 } },
        })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    // 第一个 slider 应该是 opacity
    const sliders = screen.getAllByTestId("slider");
    fireEvent.change(sliders[0], { target: { value: "0.5" } });
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.background?.media?.opacity).toBe(0.5);
  });

  // ── vignette 控件写入 theme ───────────────────────────────────────────────

  it("渲染「暗角效果」标题与 Switch", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground()}
        theme={makeTheme({ vignetteEnabled: false })}
        onChange={onChange}
      />,
    );
    expect(screen.getByText(/暗角效果/)).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("切换 vignette Switch → onChange 收到 theme.vignetteEnabled 翻转", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground()}
        theme={makeTheme({ vignetteEnabled: false })}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("switch"));
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.theme?.vignetteEnabled).toBe(true);
  });

  it("vignetteEnabled=true 时显示 5 条暗角滑条", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground()}
        theme={makeTheme({ vignetteEnabled: true })}
        onChange={onChange}
      />,
    );
    expect(screen.getByText(/亮度偏移/)).toBeInTheDocument();
    expect(screen.getByText(/中心 X/)).toBeInTheDocument();
    expect(screen.getByText(/中心 Y/)).toBeInTheDocument();
    expect(screen.getByText(/内圈位置/)).toBeInTheDocument();
    expect(screen.getByText(/外圈位置/)).toBeInTheDocument();
  });

  it("vignetteEnabled=false 时不显示暗角滑条", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground()}
        theme={makeTheme({ vignetteEnabled: false })}
        onChange={onChange}
      />,
    );
    expect(screen.queryByText(/亮度偏移/)).toBeNull();
  });

  it("拖动亮度偏移 slider → onChange 收到 theme.vignetteBrightness 更新", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground()}
        theme={makeTheme({ vignetteEnabled: true, vignetteBrightness: -30 })}
        onChange={onChange}
      />,
    );
    const brightnessSlider = screen.getByTestId("vignette-brightness");
    fireEvent.change(brightnessSlider, { target: { value: "-50" } });
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.theme?.vignetteBrightness).toBe(-50);
  });
});
