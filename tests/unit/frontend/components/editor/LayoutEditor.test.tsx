/**
 * LayoutEditor 单元测试：滑条 update + disabled 分支。
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LayoutEditor } from "@/components/editor/LayoutEditor";
import { baseLayout } from "./_fixtures";

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

describe("LayoutEditor", () => {
  it("渲染标题与雷达 X/Y 标签", () => {
    render(<LayoutEditor layout={baseLayout} onChange={() => {}} />);
    expect(screen.getByText("布局配置")).toBeInTheDocument();
    expect(screen.getByText(/雷达 X/)).toBeInTheDocument();
    expect(screen.getByText(/网格环数/)).toBeInTheDocument();
  });

  it("滑条变更触发 onChange", () => {
    const onChange = vi.fn();
    render(<LayoutEditor layout={baseLayout} onChange={onChange} />);
    fireEvent.change(screen.getAllByTestId("slider")[0], { target: { value: "1000" } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)![0].radarCX).toBe(1000);
  });

  it("disabled 时渲染禁用样式但仍显示 tooltip", () => {
    const { container } = render(
      <LayoutEditor layout={baseLayout} onChange={() => {}} disabled />,
    );
    const titled = container.querySelector('[title]');
    expect(titled?.getAttribute("title")).toContain("对比模式");
  });

  it("渲染 importMenu", () => {
    render(
      <LayoutEditor layout={baseLayout} onChange={() => {}} importMenu={<span>imp</span>} />,
    );
    expect(screen.getByText("imp")).toBeInTheDocument();
  });

  it("雷达 Y 滑条变更触发 onChange", () => {
    const onChange = vi.fn();
    render(<LayoutEditor layout={baseLayout} onChange={onChange} />);
    fireEvent.change(screen.getAllByTestId("slider")[1], { target: { value: "500" } });
    expect(onChange.mock.calls.at(-1)![0].radarCY).toBe(500);
  });

  it("网格环数滑条变更触发 onChange", () => {
    const onChange = vi.fn();
    render(<LayoutEditor layout={baseLayout} onChange={onChange} />);
    fireEvent.change(screen.getAllByTestId("slider")[2], { target: { value: "7" } });
    expect(onChange.mock.calls.at(-1)![0].gridRingCount).toBe(7);
  });

  it("网格线宽滑条变更触发 onChange（含小数）", () => {
    const onChange = vi.fn();
    render(<LayoutEditor layout={baseLayout} onChange={onChange} />);
    fireEvent.change(screen.getAllByTestId("slider")[3], { target: { value: "3.5" } });
    expect(onChange.mock.calls.at(-1)![0].gridStrokeWidth).toBe(3.5);
  });
});
