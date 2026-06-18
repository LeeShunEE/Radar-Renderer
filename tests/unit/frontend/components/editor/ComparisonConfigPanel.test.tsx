/**
 * ComparisonConfigPanel 单元测试：空对比返回 null、箭头样式与对比项更新、clamp。
 * Slider/Switch/ColorPicker/FontSelect 内联 mock。
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ComparisonConfigPanel } from "@/components/editor/ComparisonConfigPanel";
import { defaultComparisonConfig } from "@/types/constants";
import { makeMultiPageConfig } from "./_fixtures";

// sliderPassesArray 控制 mock 以数组还是裸数值回调，用于覆盖 SliderField 的 Array.isArray 两个分支
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
    <button
      role="switch"
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
vi.mock("@/components/editor/FontFamilyEditor", () => ({
  FontSelect: ({ value, onChange }: any) => (
    <input
      data-testid="font-select"
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

const configWithComp = () => {
  const c = makeMultiPageConfig(2);
  c.comparisons = [
    { ...defaultComparisonConfig, firstPageIndex: 0, secondPageIndex: 1 },
  ];
  return c;
};

describe("ComparisonConfigPanel", () => {
  it("无对比时返回 null", () => {
    const { container } = render(
      <ComparisonConfigPanel config={makeMultiPageConfig(2)} onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("渲染标题与对比箭头样式区", () => {
    render(<ComparisonConfigPanel config={configWithComp()} onChange={vi.fn()} />);
    expect(screen.getByText("对比配置")).toBeInTheDocument();
    expect(screen.getByText(/对比箭头样式/)).toBeInTheDocument();
  });

  it("改箭头字号（数字输入，clamp）→ onChange 更新 arrowFontSize", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ComparisonConfigPanel config={configWithComp()} onChange={onChange} />,
    );
    const numInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(numInput, { target: { value: "50" } });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.comparisonArrowStyle.arrowFontSize).toBe(50);
  });

  it("数字输入超上限被 clamp", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ComparisonConfigPanel config={configWithComp()} onChange={onChange} />,
    );
    const numInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(numInput, { target: { value: "9999" } });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.comparisonArrowStyle.arrowFontSize).toBe(200);
  });

  it("改 polygonMode 下拉 → onChange", () => {
    const onChange = vi.fn();
    render(<ComparisonConfigPanel config={configWithComp()} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "extend" } });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.comparisons[0].polygonMode).toBe("extend");
  });

  it("切换「显示图例」开关 → onChange", () => {
    const onChange = vi.fn();
    render(<ComparisonConfigPanel config={configWithComp()} onChange={onChange} />);
    const legendSwitch = screen.getAllByRole("switch")[0];
    fireEvent.click(legendSwitch);
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.comparisons[0].showLegend).toBe(
      !defaultComparisonConfig.showLegend,
    );
  });

  it("改箭头颜色 ColorPicker → onChange", () => {
    const onChange = vi.fn();
    render(<ComparisonConfigPanel config={configWithComp()} onChange={onChange} />);
    fireEvent.change(screen.getAllByTestId("color-picker")[0], {
      target: { value: "#abcdef" },
    });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.comparisonArrowStyle.arrowColor).toBe("#abcdef");
  });

  it("数字输入空值经 `|| 0` 兜底后 clamp 到下限", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ComparisonConfigPanel config={configWithComp()} onChange={onChange} />,
    );
    const numInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(numInput, { target: { value: "" } });
    // arrowFontSize min=8，空值 → 0 → clamp 到 8
    expect(onChange.mock.calls.at(-1)![0].comparisonArrowStyle.arrowFontSize).toBe(8);
  });

  it("箭头样式各 slider（X/Y 偏移、diff 字号/偏移）触发对应 onChange", () => {
    const onChange = vi.fn();
    render(<ComparisonConfigPanel config={configWithComp()} onChange={onChange} />);
    const s = screen.getAllByTestId("slider");
    fireEvent.change(s[0], { target: { value: "60" } });
    expect(onChange.mock.calls.at(-1)![0].comparisonArrowStyle.arrowFontSize).toBe(60);
    fireEvent.change(s[1], { target: { value: "30" } });
    expect(onChange.mock.calls.at(-1)![0].comparisonArrowStyle.arrowOffsetX).toBe(30);
    fireEvent.change(s[2], { target: { value: "-30" } });
    expect(onChange.mock.calls.at(-1)![0].comparisonArrowStyle.arrowOffsetY).toBe(-30);
    fireEvent.change(s[3], { target: { value: "40" } });
    expect(onChange.mock.calls.at(-1)![0].comparisonArrowStyle.diffFontSize).toBe(40);
    fireEvent.change(s[4], { target: { value: "20" } });
    expect(onChange.mock.calls.at(-1)![0].comparisonArrowStyle.diffOffsetX).toBe(20);
    fireEvent.change(s[5], { target: { value: "-20" } });
    expect(onChange.mock.calls.at(-1)![0].comparisonArrowStyle.diffOffsetY).toBe(-20);
  });

  it("增强色 / 减弱色 ColorPicker → onChange", () => {
    const onChange = vi.fn();
    render(<ComparisonConfigPanel config={configWithComp()} onChange={onChange} />);
    const pickers = screen.getAllByTestId("color-picker");
    fireEvent.change(pickers[1], { target: { value: "#111111" } });
    expect(onChange.mock.calls.at(-1)![0].comparisonArrowStyle.diffEnhanceColor).toBe("#111111");
    fireEvent.change(pickers[2], { target: { value: "#222222" } });
    expect(onChange.mock.calls.at(-1)![0].comparisonArrowStyle.diffWeakenColor).toBe("#222222");
  });

  it("各对比项 SliderField 通过 data-field-id 定位并触发对应 onChange", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ComparisonConfigPanel config={configWithComp()} onChange={onChange} />,
    );
    const sliderIn = (fieldId: string, nth = 0) =>
      container
        .querySelector(`[data-field-id="${fieldId}"]`)!
        .querySelectorAll('[data-testid="slider"]')[nth] as HTMLElement;

    fireEvent.change(sliderIn("comparison:0:delayFrames"), { target: { value: "10" } });
    expect(onChange.mock.calls.at(-1)![0].comparisons[0].delayFrames).toBe(10);
    fireEvent.change(sliderIn("comparison:0:swapDurationFrames"), { target: { value: "20" } });
    expect(onChange.mock.calls.at(-1)![0].comparisons[0].swapDurationFrames).toBe(20);
    fireEvent.change(sliderIn("comparison:0:silhouetteSwapOffset", 0), { target: { value: "30" } });
    expect(onChange.mock.calls.at(-1)![0].comparisons[0].silhouetteSwapOffsetX).toBe(30);
    fireEvent.change(sliderIn("comparison:0:silhouetteSwapOffset", 1), { target: { value: "40" } });
    expect(onChange.mock.calls.at(-1)![0].comparisons[0].silhouetteSwapOffsetY).toBe(40);
    fireEvent.change(sliderIn("comparison:0:silhouetteFadeOutOpacity"), { target: { value: "0.5" } });
    expect(onChange.mock.calls.at(-1)![0].comparisons[0].silhouetteFadeOutOpacity).toBe(0.5);
    fireEvent.change(sliderIn("comparison:0:diffTriangleScale"), { target: { value: "2" } });
    expect(onChange.mock.calls.at(-1)![0].comparisons[0].diffTriangleScale).toBe(2);
    fireEvent.change(sliderIn("comparison:0:dualRatingSlideFrames"), { target: { value: "15" } });
    expect(onChange.mock.calls.at(-1)![0].comparisons[0].dualRatingSlideFrames).toBe(15);
    fireEvent.change(sliderIn("comparison:0:dualRatingFadeFrames"), { target: { value: "25" } });
    expect(onChange.mock.calls.at(-1)![0].comparisons[0].dualRatingFadeFrames).toBe(25);
    fireEvent.change(sliderIn("comparison:0:legendDotRadius"), { target: { value: "10" } });
    expect(onChange.mock.calls.at(-1)![0].comparisons[0].legendDotRadius).toBe(10);
  });

  it("图例字号 / XY 偏移 slider 触发 onChange", () => {
    const onChange = vi.fn();
    render(<ComparisonConfigPanel config={configWithComp()} onChange={onChange} />);
    // 这些 SliderField 未包 data-field-id，用 label 文本定位最近的 slider
    const sliderByLabel = (label: string) =>
      screen
        .getByText(label)
        .closest("div.space-y-1")!
        .querySelector('[data-testid="slider"]') as HTMLElement;

    fireEvent.change(sliderByLabel("图例字号"), { target: { value: "30" } });
    expect(onChange.mock.calls.at(-1)![0].comparisons[0].legendFontSize).toBe(30);
    fireEvent.change(sliderByLabel("图例 X 偏移"), { target: { value: "100" } });
    expect(onChange.mock.calls.at(-1)![0].comparisons[0].legendOffsetX).toBe(100);
    fireEvent.change(sliderByLabel("图例 Y 偏移"), { target: { value: "-100" } });
    expect(onChange.mock.calls.at(-1)![0].comparisons[0].legendOffsetY).toBe(-100);
  });

  it("改图例字体 FontSelect → onChange", () => {
    const onChange = vi.fn();
    render(<ComparisonConfigPanel config={configWithComp()} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("font-select"), { target: { value: "Inter" } });
    expect(onChange.mock.calls.at(-1)![0].comparisons[0].legendFontFamily).toBe("Inter");
  });

  it("SliderField 回调传裸数值时直接取值（非数组分支）", () => {
    h.sliderPassesArray = false;
    try {
      const onChange = vi.fn();
      render(<ComparisonConfigPanel config={configWithComp()} onChange={onChange} />);
      fireEvent.change(screen.getAllByTestId("slider")[0], { target: { value: "55" } });
      expect(onChange.mock.calls.at(-1)![0].comparisonArrowStyle.arrowFontSize).toBe(55);
    } finally {
      h.sliderPassesArray = true;
    }
  });
});
