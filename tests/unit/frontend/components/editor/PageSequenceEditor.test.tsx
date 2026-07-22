import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageSequenceEditor } from "@/components/editor/PageSequenceEditor";
import { defaultMultiPageConfig, defaultRadarProps } from "@/types/constants";
import { ComparisonPairSchema, type MultiPageConfig } from "@/types/radar";

function makeConfig(
  names: string[],
  pairs: Array<[number, number]> = [],
): MultiPageConfig {
  return {
    ...defaultMultiPageConfig,
    pages: names.map((characterName) => ({
      ...defaultRadarProps,
      characterName,
    })),
    comparisons: pairs.map(([firstPageIndex, secondPageIndex]) =>
      ComparisonPairSchema.parse({ firstPageIndex, secondPageIndex }),
    ),
  };
}

function renderEditor(
  config: MultiPageConfig,
  overrides: Partial<React.ComponentProps<typeof PageSequenceEditor>> = {},
) {
  const props: React.ComponentProps<typeof PageSequenceEditor> = {
    config,
    activePageIndex: 0,
    onSetActive: vi.fn(),
    onAddPage: vi.fn(),
    onDuplicatePage: vi.fn(),
    onRemovePage: vi.fn(),
    onReorderPageSequence: vi.fn(),
    onToggleComparison: vi.fn(),
    ...overrides,
  };
  return { ...render(<PageSequenceEditor {...props} />), props };
}

describe("PageSequenceEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("把对比页渲染在同一绑定组且操作位于各自 bar", () => {
    renderEditor(makeConfig(["A", "B", "C"], [[0, 1]]));

    expect(
      screen.getByRole("group", { name: "对比绑定：A 与 B" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "解除 A 与 B 的对比" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "B 已参与对比" })).toBeDisabled();
    expect(screen.getAllByText("复制")).toHaveLength(3);
    expect(screen.getAllByText("删除")).toHaveLength(3);
  });

  it("点击 bar 选择页面，点击操作按钮不会误选", async () => {
    const user = userEvent.setup();
    const onSetActive = vi.fn();
    const onDuplicatePage = vi.fn();
    renderEditor(makeConfig(["A", "B"]), {
      onSetActive,
      onDuplicatePage,
    });

    await user.click(screen.getByRole("button", { name: "选择页面 B" }));
    expect(onSetActive).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole("button", { name: "复制 A" }));
    expect(onDuplicatePage).toHaveBeenCalledWith(0);
    expect(onSetActive).toHaveBeenCalledTimes(1);
  });

  it("普通页可以与下一普通页建立对比，末页按钮说明禁用原因", async () => {
    const user = userEvent.setup();
    const onToggleComparison = vi.fn();
    renderEditor(makeConfig(["A", "B"]), { onToggleComparison });

    await user.click(
      screen.getByRole("button", { name: "将 A 与 B 设为对比" }),
    );
    expect(onToggleComparison).toHaveBeenCalledWith(0, 1);
    expect(screen.getByRole("button", { name: "B 没有下一页" })).toBeDisabled();
  });

  it("删除绑定成员时先确认，确认后只删除目标页", async () => {
    const user = userEvent.setup();
    const onRemovePage = vi.fn();
    renderEditor(makeConfig(["A", "B"], [[0, 1]]), { onRemovePage });

    await user.click(screen.getByRole("button", { name: "删除 B" }));
    expect(screen.getByText(/解除 A 与 B 的对比/)).toBeVisible();
    expect(onRemovePage).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "确认删除" }));
    expect(onRemovePage).toHaveBeenCalledWith(1);
  });

  it("取消删除绑定成员时保持配置不变", async () => {
    const user = userEvent.setup();
    const onRemovePage = vi.fn();
    renderEditor(makeConfig(["A", "B"], [[0, 1]]), { onRemovePage });

    await user.click(screen.getByRole("button", { name: "删除 A" }));
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(onRemovePage).not.toHaveBeenCalled();
    expect(screen.queryByText(/解除 A 与 B 的对比/)).not.toBeInTheDocument();
  });

  it("删除普通页无需确认即可回调", async () => {
    const user = userEvent.setup();
    const onRemovePage = vi.fn();
    renderEditor(makeConfig(["A", "B"]), { onRemovePage });

    await user.click(screen.getByRole("button", { name: "删除 A" }));

    expect(onRemovePage).toHaveBeenCalledWith(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("键盘可拿起并取消整个对比组", async () => {
    const user = userEvent.setup();
    const onReorderPageSequence = vi.fn();
    renderEditor(makeConfig(["A", "B", "C"], [[0, 1]]), {
      onReorderPageSequence,
    });

    const handle = screen.getAllByRole("button", {
      name: "拖动对比组 A 与 B",
    })[0];
    handle.focus();
    await user.keyboard("[Space]");
    expect(handle).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("[Escape]");
    expect(handle).not.toHaveAttribute("aria-pressed");
    expect(onReorderPageSequence).not.toHaveBeenCalled();
  });

  it("绑定组的两个拖拽柄都指向同一原子组", () => {
    renderEditor(makeConfig(["A", "B", "C"], [[0, 1]]));

    const handles = screen.getAllByRole("button", {
      name: "拖动对比组 A 与 B",
    });

    expect(handles).toHaveLength(2);
    expect(handles[0]).toHaveAttribute("aria-roledescription", "sortable");
    expect(handles[1]).toHaveAttribute("aria-roledescription", "sortable");
  });
});
