/**
 * EffectsConfigEditor 单元测试：阈值滑条 + 弹窗/光晕开关与样式按钮。
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EffectsConfigEditor } from "@/components/editor/EffectsConfigEditor";
import { baseAnimation } from "./_fixtures";

vi.mock("@/components/ui/slider", () => ({
  Slider: ({ value, onValueChange }: any) => (
    <input
      type="range"
      data-testid="slider"
      min={-10000}
      max={10000}
      value={value?.[0] ?? 0}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
    />
  ),
}));
vi.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <button role="switch" aria-checked={checked} onClick={() => onCheckedChange?.(!checked)} />
  ),
}));

describe("EffectsConfigEditor", () => {
  it("渲染标题与阈值", () => {
    render(<EffectsConfigEditor pageIndex={0} animation={baseAnimation} onChange={() => {}} />);
    expect(screen.getByText("特效配置")).toBeInTheDocument();
    expect(screen.getByText(/高属性阈值/)).toBeInTheDocument();
  });

  it("点击弹窗样式按钮触发 onChange", () => {
    const onChange = vi.fn();
    render(<EffectsConfigEditor pageIndex={0} animation={baseAnimation} onChange={onChange} />);
    fireEvent.click(screen.getByText("弹跳"));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)![0].valuePopupStyle).toBe("bounce");
  });

  it("关闭数值弹窗开关触发 onChange", () => {
    const onChange = vi.fn();
    render(<EffectsConfigEditor pageIndex={0} animation={baseAnimation} onChange={onChange} />);
    const sw = screen.getAllByRole("switch")[0];
    fireEvent.click(sw);
    expect(onChange.mock.calls.at(-1)![0].valuePopupEnabled).toBe(false);
  });

  it("高数值光晕关闭时不渲染光晕样式按钮", () => {
    render(<EffectsConfigEditor pageIndex={0} animation={baseAnimation} onChange={() => {}} />);
    expect(screen.queryByText("涟漪")).toBeNull();
  });

  it("高数值光晕开启时渲染光晕样式按钮并可切换", () => {
    const onChange = vi.fn();
    const anim = { ...baseAnimation, highValueGlowEnabled: true };
    render(<EffectsConfigEditor pageIndex={0} animation={anim} onChange={onChange} />);
    fireEvent.click(screen.getByText("涟漪"));
    expect(onChange.mock.calls.at(-1)![0].highValueGlowStyle).toBe("ripple");
  });

  it("阈值滑条变更触发 onChange", () => {
    const onChange = vi.fn();
    render(<EffectsConfigEditor pageIndex={0} animation={baseAnimation} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("slider"), { target: { value: "150" } });
    expect(onChange.mock.calls.at(-1)![0].highValueThreshold).toBe(150);
  });
});
