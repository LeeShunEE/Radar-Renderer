/**
 * AttributeEditor 单元测试：属性名/值编辑 + 高属性值分支。
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AttributeEditor } from "@/components/editor/AttributeEditor";
import { baseAnimation, baseAttribute } from "./_fixtures";

// mock 的 range 输入框必须显式设 min/max：原生 range 默认 max=100 会把测试值（如 150）钳制，
// 甚至当基础值本就被钳（960→100）时 change 无变化、React 去重导致 onValueChange 不触发
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

const attrs = [0, 1].map((i) => baseAttribute(i));

describe("AttributeEditor", () => {
  it("渲染属性编辑标题与阈值提示", () => {
    render(
      <AttributeEditor attributes={attrs} animation={baseAnimation} onChange={() => {}} />,
    );
    expect(screen.getByText("属性编辑")).toBeInTheDocument();
    expect(screen.getByText(/超过阈值/)).toBeInTheDocument();
  });

  it("修改属性全称触发 onChange", () => {
    const onChange = vi.fn();
    render(
      <AttributeEditor attributes={attrs} animation={baseAnimation} onChange={onChange} />,
    );
    // 受控输入框：直接 change 整值，避免 user.type 逐字符被 React 重置
    const input = screen.getAllByPlaceholderText("属性名")[0];
    fireEvent.change(input, { target: { value: "新属性" } });
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)![0];
    expect(last[0].label).toBe("新属性");
  });

  it("滑条变更属性值触发 onChange", () => {
    const onChange = vi.fn();
    render(
      <AttributeEditor attributes={attrs} animation={baseAnimation} onChange={onChange} />,
    );
    // 第 0 个属性有 3 个滑条（value、labelOffsetX、labelOffsetY），第一个是 value
    fireEvent.change(screen.getAllByTestId("slider")[0], { target: { value: "150" } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)![0][0].value).toBe(150);
  });

  it("labelOffsetY 为 undefined 时回退 0 渲染", () => {
    const a = [{ ...baseAttribute(0), labelOffsetY: undefined }];
    render(<AttributeEditor attributes={a} animation={baseAnimation} onChange={() => {}} />);
    expect(screen.getByText(/Y偏移: 0/)).toBeInTheDocument();
  });

  it("高属性值（>= 阈值）渲染高亮样式", () => {
    const high = [{ ...baseAttribute(0), value: 200 }];
    const { container } = render(
      <AttributeEditor attributes={high} animation={baseAnimation} onChange={() => {}} />,
    );
    // 数值 span 命中高亮 class
    expect(container.querySelector(".text-amber-400")).not.toBeNull();
  });
});
