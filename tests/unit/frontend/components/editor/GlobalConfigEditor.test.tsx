import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalConfigEditor } from "@/components/editor/GlobalConfigEditor";
import { makeMultiPageConfig } from "./_fixtures";

vi.mock("@/components/files/AssetSelector", () => ({
  AssetSelector: ({ embedded }: { embedded?: boolean }) => (
    <div
      aria-label="背景音乐资源列表"
      data-embedded={embedded ? "true" : "false"}
    />
  ),
}));

vi.mock("@/components/editor/GlobalOverridePanel", () => ({
  GlobalOverridePanel: () => <div aria-label="全局覆盖设置" />,
}));

function renderEditor(overrides: Record<string, unknown> = {}) {
  const props = {
    config: makeMultiPageConfig(2),
    activePageIndex: 0,
    onChange: vi.fn(),
    onSetActive: vi.fn(),
    onAddPage: vi.fn(),
    onDuplicatePage: vi.fn(),
    onRemovePage: vi.fn(),
    onReorderPageSequence: vi.fn(),
    onPreviewAll: vi.fn(),
    ...overrides,
  };
  const result = render(<GlobalConfigEditor {...props} />);
  return { ...props, ...result };
}

describe("GlobalConfigEditor", () => {
  it("按页面编排、背景音乐、总时长、预览的顺序呈现全局操作", () => {
    const { container } = renderEditor();

    const pageSequence = screen.getByRole("heading", { name: "页面编排" });
    const music = screen.getByRole("button", { name: /展开背景音乐选择器/ });
    const duration = screen.getByRole("button", { name: /展开时长明细/ });
    const preview = screen.getByRole("button", { name: /全局预览/ });

    expect(
      pageSequence.compareDocumentPosition(music) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      music.compareDocumentPosition(duration) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      duration.compareDocumentPosition(preview) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.querySelector('[title="上移"]')).toBeNull();
    expect(container.querySelector('[title="下移"]')).toBeNull();
  });

  it("页面条右侧操作触发选择、复制、删除和添加回调", () => {
    const props = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "选择页面 角色2" }));
    expect(props.onSetActive).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "复制 角色1" }));
    expect(props.onDuplicatePage).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole("button", { name: "删除 角色1" }));
    expect(props.onRemovePage).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole("button", { name: "添加页面" }));
    expect(props.onAddPage).toHaveBeenCalledOnce();
  });

  it("点击与下一页对比会添加对比配置", () => {
    const props = renderEditor();

    fireEvent.click(
      screen.getByRole("button", { name: "将 角色1 与 角色2 设为对比" }),
    );

    expect(props.onChange).toHaveBeenCalledOnce();
    expect(props.onChange.mock.calls[0][0].comparisons).toEqual([
      expect.objectContaining({ firstPageIndex: 0, secondPageIndex: 1 }),
    ]);
  });

  it("背景音乐选择器默认折叠，展开后以内嵌模式呈现", () => {
    renderEditor();
    expect(screen.queryByLabelText("背景音乐资源列表")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /展开背景音乐选择器/ }));

    expect(screen.getByLabelText("背景音乐资源列表")).toHaveAttribute(
      "data-embedded",
      "true",
    );
    expect(
      screen.getByRole("button", { name: /收起背景音乐选择器/ }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("显示已选音乐文件名并允许展开资源选择器", () => {
    renderEditor({
      config: { ...makeMultiPageConfig(2), musicUrl: "music/theme-song.mp3" },
    });

    expect(screen.getByText("theme-song.mp3")).toBeInTheDocument();
  });

  it("总时长摘要常驻，页面明细默认折叠", () => {
    renderEditor();

    expect(screen.getByText(/共 2 页/)).toBeInTheDocument();
    expect(screen.queryByText(/页 1 · 角色1/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /展开时长明细/ }));

    expect(screen.getByText(/页 1 · 角色1/)).toBeInTheDocument();
    expect(screen.getByText(/页 2 · 角色2/)).toBeInTheDocument();
  });

  it("全局预览按钮触发预览回调", () => {
    const props = renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /全局预览/ }));
    expect(props.onPreviewAll).toHaveBeenCalledOnce();
  });
});
