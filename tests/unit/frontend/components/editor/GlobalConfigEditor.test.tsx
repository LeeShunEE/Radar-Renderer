/**
 * GlobalConfigEditor 单元测试：页面列表操作 + 对比开关 toggleComparison + 时长统计。
 * AssetSelector / GlobalOverridePanel 子组件 stub 化，聚焦本组件逻辑。
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GlobalConfigEditor } from "@/components/editor/GlobalConfigEditor";
import { makeMultiPageConfig } from "./_fixtures";

vi.mock("@/components/files/AssetSelector", () => ({
  AssetSelector: () => <div data-testid="asset-selector" />,
}));
vi.mock("@/components/editor/GlobalOverridePanel", () => ({
  GlobalOverridePanel: () => <div data-testid="global-override" />,
}));

const config = () => makeMultiPageConfig(2);

describe("GlobalConfigEditor", () => {
  it("渲染标题与页面按钮", () => {
    render(
      <GlobalConfigEditor
        config={config()}
        activePageIndex={0}
        onChange={vi.fn()}
        onSetActive={vi.fn()}
        onAddPage={vi.fn()}
        onDuplicatePage={vi.fn()}
        onRemovePage={vi.fn()}
        onMovePage={vi.fn()}
        onPreviewAll={vi.fn()}
      />,
    );
    expect(screen.getByText("全局配置")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /角色1/ })).toBeInTheDocument();
  });

  it("点页面按钮触发 onSetActive", () => {
    const onSetActive = vi.fn();
    render(
      <GlobalConfigEditor
        config={config()}
        activePageIndex={0}
        onChange={vi.fn()}
        onSetActive={onSetActive}
        onAddPage={vi.fn()}
        onDuplicatePage={vi.fn()}
        onRemovePage={vi.fn()}
        onMovePage={vi.fn()}
        onPreviewAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /角色2/ }));
    expect(onSetActive).toHaveBeenCalledWith(1);
  });

  it("首页上移禁用、末页下移禁用", () => {
    render(
      <GlobalConfigEditor
        config={config()}
        activePageIndex={0}
        onChange={vi.fn()}
        onSetActive={vi.fn()}
        onAddPage={vi.fn()}
        onDuplicatePage={vi.fn()}
        onRemovePage={vi.fn()}
        onMovePage={vi.fn()}
        onPreviewAll={vi.fn()}
      />,
    );
    expect(screen.getAllByTitle("上移")[0]).toBeDisabled();
    expect(screen.getAllByTitle("下移")[1]).toBeDisabled();
  });

  it("复制 / 删除按钮分别触发对应回调", () => {
    const onDuplicatePage = vi.fn();
    const onRemovePage = vi.fn();
    render(
      <GlobalConfigEditor
        config={config()}
        activePageIndex={0}
        onChange={vi.fn()}
        onSetActive={vi.fn()}
        onAddPage={vi.fn()}
        onDuplicatePage={onDuplicatePage}
        onRemovePage={onRemovePage}
        onMovePage={vi.fn()}
        onPreviewAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByTitle("复制")[0]);
    expect(onDuplicatePage).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getAllByTitle("删除")[0]);
    expect(onRemovePage).toHaveBeenCalledWith(0);
  });

  it("添加页面按钮触发 onAddPage", () => {
    const onAddPage = vi.fn();
    render(
      <GlobalConfigEditor
        config={config()}
        activePageIndex={0}
        onChange={vi.fn()}
        onSetActive={vi.fn()}
        onAddPage={onAddPage}
        onDuplicatePage={vi.fn()}
        onRemovePage={vi.fn()}
        onMovePage={vi.fn()}
        onPreviewAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("+ 添加页面"));
    expect(onAddPage).toHaveBeenCalled();
  });

  it("点 ⚡对比 添加对比；再点移除", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <GlobalConfigEditor
        config={config()}
        activePageIndex={0}
        onChange={onChange}
        onSetActive={vi.fn()}
        onAddPage={vi.fn()}
        onDuplicatePage={vi.fn()}
        onRemovePage={vi.fn()}
        onMovePage={vi.fn()}
        onPreviewAll={vi.fn()}
      />,
    );
    const toggle = screen.getByRole("button", { name: /对比/ });
    fireEvent.click(toggle);
    let next = onChange.mock.calls.at(-1)![0];
    expect(next.comparisons).toHaveLength(1);
    expect(next.comparisons[0]).toMatchObject({ firstPageIndex: 0, secondPageIndex: 1 });

    // 用新 config 重新渲染并再次点击 → 移除
    rerender(
      <GlobalConfigEditor
        config={next}
        activePageIndex={0}
        onChange={onChange}
        onSetActive={vi.fn()}
        onAddPage={vi.fn()}
        onDuplicatePage={vi.fn()}
        onRemovePage={vi.fn()}
        onMovePage={vi.fn()}
        onPreviewAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /对比/ }));
    const removed = onChange.mock.calls.at(-1)![0];
    expect(removed.comparisons).toHaveLength(0);
  });

  it("总时长统计渲染（帧/秒）", () => {
    render(
      <GlobalConfigEditor
        config={config()}
        activePageIndex={0}
        onChange={vi.fn()}
        onSetActive={vi.fn()}
        onAddPage={vi.fn()}
        onDuplicatePage={vi.fn()}
        onRemovePage={vi.fn()}
        onMovePage={vi.fn()}
        onPreviewAll={vi.fn()}
      />,
    );
    expect(screen.getByText(/总时长：/)).toBeInTheDocument();
  });
});
