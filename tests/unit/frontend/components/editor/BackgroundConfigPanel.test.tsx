/**
 * BackgroundConfigPanel 单元测试：
 * - 三态类型切换（gradient/image/video）
 * - 媒体控件（AssetSelector/opacity/blur/scale/position）仅 type≠gradient 时显示
 * - video 专属控件（loop/playbackRate/startFrom/muted 声音开关）仅 type=video 时显示
 * - 背景视频声音开关：开启时显示客户端导出无音频明示
 * - 暗角效果控件（vignette）写入 theme
 * - 各 handler 覆盖率补强
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BackgroundConfigPanel } from "@/components/editor/BackgroundConfigPanel";
import type { BackgroundConfig, BackgroundMediaConfig, RadarTheme } from "@/types/radar";
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

const defaultVideoOptions: BackgroundMediaConfig["videoOptions"] = {
  loop: true,
  muted: true,
  playbackRate: 1,
  startFrom: 0,
};

function makeMedia(overrides: Partial<BackgroundMediaConfig> = {}): BackgroundMediaConfig {
  return {
    src: "",
    opacity: 1,
    blur: 0,
    scale: "cover",
    position: "center",
    videoOptions: { ...defaultVideoOptions },
    ...overrides,
  };
}

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
        background={makeBackground({ type: "image", media: makeMedia() })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText(/渐变/));
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.background?.type).toBe("gradient");
  });

  // ── handleTypeChange 覆盖：从 image → video → gradient（所有分支） ────────

  it("从 image 切到 video 再切到 gradient → onChange 分别收到正确 type", () => {
    const { rerender } = render(
      <BackgroundConfigPanel
        background={makeBackground({ type: "image", media: makeMedia() })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    // image → video
    fireEvent.click(screen.getByText(/视频/));
    expect(onChange.mock.calls.at(-1)![0].background?.type).toBe("video");

    // 重新渲染为 video
    rerender(
      <BackgroundConfigPanel
        background={makeBackground({ type: "video", media: makeMedia() })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    // video → gradient
    fireEvent.click(screen.getByText(/渐变/));
    expect(onChange.mock.calls.at(-1)![0].background?.type).toBe("gradient");
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
        background={makeBackground({ type: "image", media: makeMedia() })}
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
        background={makeBackground({ type: "image", media: makeMedia() })}
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
        background={makeBackground({ type: "video", media: makeMedia() })}
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
        background={makeBackground({ type: "image", media: makeMedia() })}
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

  // ── blur slider 写入 background.media.blur ───────────────────────────────

  it("type=image 时，拖动 blur slider → onChange 收到 background.media.blur 更新", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({ type: "image", media: makeMedia({ blur: 0 }) })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    // sliders[0]=opacity, sliders[1]=blur
    const sliders = screen.getAllByTestId("slider");
    fireEvent.change(sliders[1], { target: { value: "10" } });
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.background?.media?.blur).toBe(10);
  });

  // ── scale 按钮 写入 background.media.scale ───────────────────────────────

  it("点击 contain 按钮 → onChange 收到 background.media.scale=contain", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({ type: "image", media: makeMedia({ scale: "cover" }) })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("contain"));
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.background?.media?.scale).toBe("contain");
  });

  // ── position 按钮 写入 background.media.position ─────────────────────────

  it("点击 top 按钮 → onChange 收到 background.media.position=top", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({ type: "image", media: makeMedia({ position: "center" }) })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("top"));
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.background?.media?.position).toBe("top");
  });

  // ── video: loop Switch ────────────────────────────────────────────────────

  it("type=video 时，切换循环 Switch → onChange 收到 videoOptions.loop=false（默认 true 时）", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({
          type: "video",
          media: makeMedia({ videoOptions: { ...defaultVideoOptions, loop: true } }),
        })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    // 循环 switch 是第一个 role=switch（vignette 的 switch 在后面，此时 vignetteEnabled=false 只有一个）
    const switches = screen.getAllByRole("switch");
    // switches[0] = 循环（视频区）；switches[1] = vignette（暗角区）
    // 确认循环的 switch aria-checked=true，点击 → loop=false
    expect(switches[0].getAttribute("aria-checked")).toBe("true");
    fireEvent.click(switches[0]);
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.background?.media?.videoOptions?.loop).toBe(false);
  });

  // ── video: playbackRate slider ────────────────────────────────────────────

  it("type=video 时，拖动播放速率 slider → onChange 收到 videoOptions.playbackRate 更新", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({
          type: "video",
          media: makeMedia({ videoOptions: { ...defaultVideoOptions, playbackRate: 1 } }),
        })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    // sliders: opacity(0), blur(1), playbackRate(2), startFrom(3)
    const sliders = screen.getAllByTestId("slider");
    fireEvent.change(sliders[2], { target: { value: "2" } });
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.background?.media?.videoOptions?.playbackRate).toBe(2);
  });

  // ── video: startFrom slider ───────────────────────────────────────────────

  it("type=video 时，拖动起始位置 slider → onChange 收到 videoOptions.startFrom 更新", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({
          type: "video",
          media: makeMedia({ videoOptions: { ...defaultVideoOptions, startFrom: 0 } }),
        })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    // sliders: opacity(0), blur(1), playbackRate(2), startFrom(3)
    const sliders = screen.getAllByTestId("slider");
    fireEvent.change(sliders[3], { target: { value: "5000" } });
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.background?.media?.videoOptions?.startFrom).toBe(5000);
  });

  // ── 声音开关（muted toggle）────────────────────────────────────────────────

  it("type=video 时渲染「声音」标签和对应 Switch", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({
          type: "video",
          media: makeMedia({ videoOptions: { ...defaultVideoOptions, muted: true } }),
        })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    expect(screen.getByText(/声音/)).toBeInTheDocument();
  });

  it("type=video，muted=true（默认），声音 Switch 的 aria-checked 应为 false（声音关）", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({
          type: "video",
          media: makeMedia({ videoOptions: { ...defaultVideoOptions, muted: true } }),
        })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    // 声音 Switch：checked = !muted → false
    const muteSwitch = screen.getByTestId("video-muted-switch");
    expect(muteSwitch.getAttribute("aria-checked")).toBe("false");
  });

  it("type=video，muted=true → 点击声音 Switch → onChange 收到 videoOptions.muted=false（开声音）", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({
          type: "video",
          media: makeMedia({ videoOptions: { ...defaultVideoOptions, muted: true } }),
        })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId("video-muted-switch"));
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.background?.media?.videoOptions?.muted).toBe(false);
  });

  it("type=video，muted=false → 点击声音 Switch → onChange 收到 videoOptions.muted=true（关声音）", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({
          type: "video",
          media: makeMedia({ videoOptions: { ...defaultVideoOptions, muted: false } }),
        })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId("video-muted-switch"));
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.background?.media?.videoOptions?.muted).toBe(true);
  });

  // ── 客户端导出无音频明示（HARD requirement）──────────────────────────────

  it("type=video，muted=false（声音开）→ 显示含「浏览器」「导出」「不含背景视频声音」的明示提示", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({
          type: "video",
          media: makeMedia({ videoOptions: { ...defaultVideoOptions, muted: false } }),
        })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    const notice = screen.getByTestId("client-export-audio-notice");
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toMatch(/浏览器/);
    expect(notice.textContent).toMatch(/导出/);
    expect(notice.textContent).toMatch(/不含背景视频声音/);
  });

  it("type=video，muted=true（声音关）→ 不显示客户端导出明示提示", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({
          type: "video",
          media: makeMedia({ videoOptions: { ...defaultVideoOptions, muted: true } }),
        })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    expect(screen.queryByTestId("client-export-audio-notice")).toBeNull();
  });

  it("type=image，不显示客户端导出明示提示", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({ type: "image", media: makeMedia() })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    expect(screen.queryByTestId("client-export-audio-notice")).toBeNull();
  });

  it("type=gradient，不显示客户端导出明示提示", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground({ type: "gradient" })}
        theme={makeTheme()}
        onChange={onChange}
      />,
    );
    expect(screen.queryByTestId("client-export-audio-notice")).toBeNull();
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

  // ── vignette: centerX/centerY/innerStop/outerStop sliders ────────────────

  it("拖动中心 X slider → onChange 收到 theme.vignetteCenterX 更新", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground()}
        theme={makeTheme({ vignetteEnabled: true, vignetteCenterX: 50 })}
        onChange={onChange}
      />,
    );
    // brightness uses data-testid="vignette-brightness" (not "slider"), so getAllByTestId("slider")
    // returns: [0]=centerX, [1]=centerY, [2]=innerStop, [3]=outerStop
    const sliders = screen.getAllByTestId("slider");
    fireEvent.change(sliders[0], { target: { value: "30" } });
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.theme?.vignetteCenterX).toBe(30);
  });

  it("拖动中心 Y slider → onChange 收到 theme.vignetteCenterY 更新", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground()}
        theme={makeTheme({ vignetteEnabled: true, vignetteCenterY: 50 })}
        onChange={onChange}
      />,
    );
    // brightness has testId="vignette-brightness"; sliders[0]=centerX,[1]=centerY,[2]=innerStop,[3]=outerStop
    const sliders = screen.getAllByTestId("slider");
    fireEvent.change(sliders[1], { target: { value: "70" } });
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.theme?.vignetteCenterY).toBe(70);
  });

  it("拖动内圈位置 slider → onChange 收到 theme.vignetteInnerStop 更新", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground()}
        theme={makeTheme({ vignetteEnabled: true, vignetteInnerStop: 30 })}
        onChange={onChange}
      />,
    );
    // sliders[0]=centerX,[1]=centerY,[2]=innerStop,[3]=outerStop
    const sliders = screen.getAllByTestId("slider");
    fireEvent.change(sliders[2], { target: { value: "40" } });
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.theme?.vignetteInnerStop).toBe(40);
  });

  it("拖动外圈位置 slider → onChange 收到 theme.vignetteOuterStop 更新", () => {
    render(
      <BackgroundConfigPanel
        background={makeBackground()}
        theme={makeTheme({ vignetteEnabled: true, vignetteOuterStop: 90 })}
        onChange={onChange}
      />,
    );
    // sliders[0]=centerX,[1]=centerY,[2]=innerStop,[3]=outerStop
    const sliders = screen.getAllByTestId("slider");
    fireEvent.change(sliders[3], { target: { value: "80" } });
    const call = onChange.mock.calls.at(-1)![0];
    expect(call.theme?.vignetteOuterStop).toBe(80);
  });
});
