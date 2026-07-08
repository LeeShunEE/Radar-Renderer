/**
 * PreviewTargetSelector 单元测试：值反映真实预览状态、切换回调。
 * shadcn Select 用 mock（同 ConfigPersistencePanel 测试的打桩方式）。
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PreviewTargetSelector } from "@/components/editor/PreviewTargetSelector";
import { makeMultiPageConfig } from "./_fixtures";

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      data-testid="select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectValue: () => null,
}));

const pages = makeMultiPageConfig(3).pages;

const baseProps = (over: Record<string, unknown> = {}) => ({
  pages,
  previewMode: "single" as const,
  activePageIndex: 0,
  onSelectGlobal: vi.fn(),
  onSelectPage: vi.fn(),
  ...over,
});

describe("PreviewTargetSelector", () => {
  it("渲染「预览对象」说明与全部选项", () => {
    render(<PreviewTargetSelector {...baseProps()} />);
    expect(screen.getByText("预览对象")).toBeInTheDocument();
    expect(screen.getByText("全局（3 页完整视频）")).toBeInTheDocument();
    expect(screen.getByText("第1页：角色1")).toBeInTheDocument();
    expect(screen.getByText("第3页：角色3")).toBeInTheDocument();
  });

  it("单页模式 → 值为当前活动页", () => {
    render(<PreviewTargetSelector {...baseProps({ activePageIndex: 1 })} />);
    expect(screen.getByTestId("select")).toHaveValue("page-1");
  });

  it("多页（全局）模式 → 值为 global，与活动页无关", () => {
    render(
      <PreviewTargetSelector
        {...baseProps({ previewMode: "multi", activePageIndex: 2 })}
      />,
    );
    expect(screen.getByTestId("select")).toHaveValue("global");
  });

  it("选择全局 → onSelectGlobal", () => {
    const onSelectGlobal = vi.fn();
    render(<PreviewTargetSelector {...baseProps({ onSelectGlobal })} />);
    fireEvent.change(screen.getByTestId("select"), { target: { value: "global" } });
    expect(onSelectGlobal).toHaveBeenCalled();
  });

  it("选择某页 → onSelectPage(index)", () => {
    const onSelectPage = vi.fn();
    render(
      <PreviewTargetSelector
        {...baseProps({ previewMode: "multi", onSelectPage })}
      />,
    );
    fireEvent.change(screen.getByTestId("select"), { target: { value: "page-2" } });
    expect(onSelectPage).toHaveBeenCalledWith(2);
  });

  it("角色名为空时回退「页N」占位", () => {
    const blank = pages.map((p) => ({ ...p, characterName: "" }));
    render(<PreviewTargetSelector {...baseProps({ pages: blank })} />);
    expect(screen.getByText("第1页：页1")).toBeInTheDocument();
  });
});
