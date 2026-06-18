/**
 * ThemeEditor 单元测试：配色变更 + 暗角开关/滑条分支。
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeEditor } from "@/components/editor/ThemeEditor";
import { baseTheme } from "./_fixtures";

// sliderPassesArray 控制 mock 以数组还是裸数值回调，用于覆盖各 onValueChange 的 Array.isArray 两个分支
const h = vi.hoisted(() => ({ sliderPassesArray: true }));

vi.mock("@/components/ui/slider", () => ({
  Slider: ({ value, onValueChange }: any) => (
    <input
      type="range"
      data-testid="slider"
      min={-10000}
      max={10000}
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
  Switch: ({ checked, onCheckedChange }: any) => (
    <button role="switch" aria-checked={checked} onClick={() => onCheckedChange?.(!checked)} />
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

describe("ThemeEditor", () => {
  it("渲染标题与配色字段", () => {
    render(<ThemeEditor theme={baseTheme} onChange={() => {}} />);
    expect(screen.getByText("主题配色")).toBeInTheDocument();
    expect(screen.getByText("背景色")).toBeInTheDocument();
    expect(screen.getAllByTestId("color-picker").length).toBeGreaterThan(0);
  });

  it("修改配色触发 onChange", () => {
    const onChange = vi.fn();
    render(<ThemeEditor theme={baseTheme} onChange={onChange} />);
    fireEvent.change(screen.getAllByTestId("color-picker")[0], { target: { value: "#000000" } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)![0].backgroundColor).toBe("#000000");
  });

  it("vignetteEnabled=false 时不渲染暗角滑条", () => {
    render(<ThemeEditor theme={baseTheme} onChange={() => {}} />);
    expect(screen.queryByText(/亮度偏移/)).toBeNull();
  });

  it("开启暗角开关后渲染滑条并触发 onChange", () => {
    const onChange = vi.fn();
    render(<ThemeEditor theme={{ ...baseTheme, vignetteEnabled: true }} onChange={onChange} />);
    expect(screen.getByText(/亮度偏移/)).toBeInTheDocument();
    fireEvent.change(screen.getAllByTestId("slider")[0], { target: { value: "-50" } });
    expect(onChange.mock.calls.at(-1)![0].vignetteBrightness).toBe(-50);
  });

  it("切换暗角开关触发 onChange", () => {
    const onChange = vi.fn();
    render(<ThemeEditor theme={baseTheme} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange.mock.calls.at(-1)![0].vignetteEnabled).toBe(true);
  });

  it("开启暗角后中心 X/Y、内外圈滑条触发对应 onChange", () => {
    const onChange = vi.fn();
    render(
      <ThemeEditor theme={{ ...baseTheme, vignetteEnabled: true }} onChange={onChange} />,
    );
    const sliders = screen.getAllByTestId("slider");
    fireEvent.change(sliders[1], { target: { value: "30" } });
    expect(onChange.mock.calls.at(-1)![0].vignetteCenterX).toBe(30);
    fireEvent.change(sliders[2], { target: { value: "40" } });
    expect(onChange.mock.calls.at(-1)![0].vignetteCenterY).toBe(40);
    fireEvent.change(sliders[3], { target: { value: "50" } });
    expect(onChange.mock.calls.at(-1)![0].vignetteInnerStop).toBe(50);
    fireEvent.change(sliders[4], { target: { value: "80" } });
    expect(onChange.mock.calls.at(-1)![0].vignetteOuterStop).toBe(80);
  });

  it("修改其他配色字段（如网格色）触发对应 onChange", () => {
    const onChange = vi.fn();
    render(<ThemeEditor theme={baseTheme} onChange={onChange} />);
    fireEvent.change(screen.getAllByTestId("color-picker")[1], {
      target: { value: "#111111" },
    });
    expect(onChange.mock.calls.at(-1)![0].gridColor).toBe("#111111");
  });

  it("暗角滑条回调传裸数值时直接取值（非数组分支）", () => {
    h.sliderPassesArray = false;
    try {
      const onChange = vi.fn();
      render(
        <ThemeEditor theme={{ ...baseTheme, vignetteEnabled: true }} onChange={onChange} />,
      );
      const sliders = screen.getAllByTestId("slider");
      fireEvent.change(sliders[0], { target: { value: "-20" } });
      expect(onChange.mock.calls.at(-1)![0].vignetteBrightness).toBe(-20);
      fireEvent.change(sliders[1], { target: { value: "10" } });
      expect(onChange.mock.calls.at(-1)![0].vignetteCenterX).toBe(10);
      fireEvent.change(sliders[2], { target: { value: "15" } });
      expect(onChange.mock.calls.at(-1)![0].vignetteCenterY).toBe(15);
      fireEvent.change(sliders[3], { target: { value: "20" } });
      expect(onChange.mock.calls.at(-1)![0].vignetteInnerStop).toBe(20);
      fireEvent.change(sliders[4], { target: { value: "70" } });
      expect(onChange.mock.calls.at(-1)![0].vignetteOuterStop).toBe(70);
    } finally {
      h.sliderPassesArray = true;
    }
  });
});
