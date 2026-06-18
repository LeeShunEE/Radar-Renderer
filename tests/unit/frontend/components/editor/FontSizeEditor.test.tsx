/**
 * FontSizeEditor 单元测试：数值输入 clamp + 滑条 onValueChange → onChange。
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FontSizeEditor } from "@/components/editor/FontSizeEditor";
import { baseFont } from "./_fixtures";

// sliderPassesArray 控制 mock 以数组还是裸数值回调，用于覆盖 update 里 Array.isArray 两个分支
const h = vi.hoisted(() => ({ sliderPassesArray: true }));

// mock 的 range 输入框必须显式设 min/max：原生 range 默认 max=100 会把测试值（如 120）钳制
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

describe("FontSizeEditor", () => {
  it("渲染标题与全部字段", () => {
    render(<FontSizeEditor font={baseFont} onChange={() => {}} />);
    expect(screen.getByText("字体大小")).toBeInTheDocument();
    expect(screen.getByText("角色名称")).toBeInTheDocument();
    expect(screen.getAllByTestId("slider")).toHaveLength(4);
  });

  it("修改数值输入触发 onChange（按输入值）", () => {
    const onChange = vi.fn();
    const { container } = render(<FontSizeEditor font={baseFont} onChange={onChange} />);
    // 滑条 mock 也渲染了 value=72 的输入框，会与数字框撞值；用 type=number 精确定位
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    // 受控输入框：直接 change 整值，避免 user.type 逐字符被 React 重置 + clamp 误差
    fireEvent.change(input, { target: { value: "100" } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)![0].characterName).toBe(100);
  });

  it("超出上限时 clamp 到 180", () => {
    const onChange = vi.fn();
    const { container } = render(<FontSizeEditor font={baseFont} onChange={onChange} />);
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "9999" } });
    expect(onChange.mock.calls.at(-1)![0].characterName).toBe(180);
  });

  it("滑条变更触发 onChange（取数组首元素）", () => {
    const onChange = vi.fn();
    render(<FontSizeEditor font={baseFont} onChange={onChange} />);
    fireEvent.change(screen.getAllByTestId("slider")[0], { target: { value: "120" } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)![0].characterName).toBe(120);
  });

  it("渲染 importMenu 插槽", () => {
    render(
      <FontSizeEditor font={baseFont} onChange={() => {}} importMenu={<span>import-slot</span>} />,
    );
    expect(screen.getByText("import-slot")).toBeInTheDocument();
  });

  it("低于下限时 clamp 到 30", () => {
    const onChange = vi.fn();
    const { container } = render(<FontSizeEditor font={baseFont} onChange={onChange} />);
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1" } });
    expect(onChange.mock.calls.at(-1)![0].characterName).toBe(30);
  });

  it("属性标签滑条触发 onChange", () => {
    const onChange = vi.fn();
    render(<FontSizeEditor font={baseFont} onChange={onChange} />);
    fireEvent.change(screen.getAllByTestId("slider")[1], { target: { value: "60" } });
    expect(onChange.mock.calls.at(-1)![0].attributeLabel).toBe(60);
  });

  it("评级标签滑条触发 onChange", () => {
    const onChange = vi.fn();
    render(<FontSizeEditor font={baseFont} onChange={onChange} />);
    fireEvent.change(screen.getAllByTestId("slider")[2], { target: { value: "40" } });
    expect(onChange.mock.calls.at(-1)![0].ratingLabel).toBe(40);
  });

  it("数值弹出滑条触发 onChange", () => {
    const onChange = vi.fn();
    render(<FontSizeEditor font={baseFont} onChange={onChange} />);
    fireEvent.change(screen.getAllByTestId("slider")[3], { target: { value: "50" } });
    expect(onChange.mock.calls.at(-1)![0].valuePopup).toBe(50);
  });

  it("滑条回调传裸数值时直接取值（非数组分支）", () => {
    h.sliderPassesArray = false;
    try {
      const onChange = vi.fn();
      render(<FontSizeEditor font={baseFont} onChange={onChange} />);
      fireEvent.change(screen.getAllByTestId("slider")[0], { target: { value: "88" } });
      expect(onChange.mock.calls.at(-1)![0].characterName).toBe(88);
    } finally {
      h.sliderPassesArray = true;
    }
  });
});
