/**
 * AnimationConfig（导出名 AnimationConfigEditor）单元测试：
 * 滑条 update + 全局覆盖忽略开关分支。
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnimationConfigEditor } from "@/components/editor/AnimationConfig";
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

describe("AnimationConfigEditor", () => {
  it("渲染标题与字段", () => {
    render(<AnimationConfigEditor pageIndex={0} animation={baseAnimation} onChange={() => {}} />);
    expect(screen.getByText("动画配置")).toBeInTheDocument();
    expect(screen.getByText(/填充时长/)).toBeInTheDocument();
    expect(screen.getByText(/阶段时序偏移/)).toBeInTheDocument();
  });

  it("滑条变更触发 onChange", () => {
    const onChange = vi.fn();
    render(<AnimationConfigEditor pageIndex={0} animation={baseAnimation} onChange={onChange} />);
    fireEvent.change(screen.getAllByTestId("slider")[0], { target: { value: "90" } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)![0].fillDuration).toBe(90);
  });

  it("无 onToggleIgnoreOverride 时不渲染忽略按钮", () => {
    render(<AnimationConfigEditor pageIndex={0} animation={baseAnimation} onChange={() => {}} />);
    expect(screen.queryByText("无视全局")).toBeNull();
  });

  it("启用全局覆盖时渲染忽略按钮，点击切换", () => {
    const onToggle = vi.fn();
    render(
      <AnimationConfigEditor
        pageIndex={0}
        animation={baseAnimation}
        onChange={() => {}}
        overrideIgnored={{ "animation.fillDuration": false }}
        globalOverrideEnabled={{ "animation.fillDuration": true }}
        onToggleIgnoreOverride={onToggle}
      />,
    );
    const btn = screen.getByText("无视全局");
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledWith("animation.fillDuration", true);
  });

  it("已忽略状态显示「已无视全局」", () => {
    render(
      <AnimationConfigEditor
        pageIndex={0}
        animation={baseAnimation}
        onChange={() => {}}
        overrideIgnored={{ "animation.fillDuration": true }}
        globalOverrideEnabled={{ "animation.fillDuration": true }}
        onToggleIgnoreOverride={vi.fn()}
      />,
    );
    expect(screen.getByText("已无视全局")).toBeInTheDocument();
  });
});
