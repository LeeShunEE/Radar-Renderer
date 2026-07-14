/**
 * RadarValuesTable 单元测试：表头同步、单元格更新、列交换、数值 clamp、按页设活动。
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RadarValuesTable } from "@/components/editor/RadarValuesTable";
import { makeMultiPageConfig } from "./_fixtures";
import { defaultVideoPage } from "@/types/constants";

describe("RadarValuesTable", () => {
  it("无页面时返回 null", () => {
    const { container } = render(
      <RadarValuesTable
        config={{ ...makeMultiPageConfig(), pages: [] }}
        onChange={vi.fn()}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("渲染标题与同步按钮", () => {
    render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={vi.fn()}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    expect(screen.getByText("雷达数值表")).toBeInTheDocument();
    expect(screen.getByText("同步表头到全部页面")).toBeInTheDocument();
  });

  it("改表头简称 → 同步所有页面对应列", () => {
    const onChange = vi.fn();
    render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={onChange}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    const shortInputs = screen.getAllByPlaceholderText("简称");
    fireEvent.change(shortInputs[0], { target: { value: "力" } });
    const next = onChange.mock.calls.at(-1)![0];
    // 所有页面的第 0 列简称都应变为 "力"
    expect(next.pages.every((p: any) => p.attributes[0].shortLabel === "力")).toBe(true);
  });

  it("改非活动页角色名 → onChange 且 onSetActive 命中该页", () => {
    const onChange = vi.fn();
    const onSetActive = vi.fn();
    render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={onChange}
        activePageIndex={0}
        onSetActive={onSetActive}
      />,
    );
    const nameInputs = screen.getAllByPlaceholderText("角色名");
    fireEvent.change(nameInputs[1], { target: { value: "新角色" } });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.pages[1].characterName).toBe("新角色");
    expect(onSetActive).toHaveBeenCalledWith(1);
  });

  it("改活动页数值 → clamp 到 0-200", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={onChange}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    const numInputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(numInputs[0], { target: { value: "999" } });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.pages[0].attributes[0].value).toBe(200);
  });

  it("点 ▶ 交换第 0/1 列", () => {
    const onChange = vi.fn();
    render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={onChange}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    const swapRights = screen.getAllByTitle("与右侧列交换");
    // 第 0 列的 ▶
    fireEvent.click(swapRights[0]);
    const next = onChange.mock.calls.at(-1)![0];
    const before0 = makeMultiPageConfig().pages[0].attributes[0].shortLabel;
    expect(next.pages[0].attributes[1].shortLabel).toBe(before0);
  });

  it("第 0 列 ◀ 禁用", () => {
    render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={vi.fn()}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    const swapLefts = screen.getAllByTitle("与左侧列交换");
    expect(swapLefts[0]).toBeDisabled();
  });

  it("点同步按钮 → 非首页 label/shortLabel 对齐首页", () => {
    const onChange = vi.fn();
    // 先把首页第 0 列改名，再同步
    const config = makeMultiPageConfig();
    config.pages[0].attributes[0] = {
      ...config.pages[0].attributes[0],
      label: "力量",
      shortLabel: "力",
    };
    render(
      <RadarValuesTable
        config={config}
        onChange={onChange}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("同步表头到全部页面"));
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.pages[1].attributes[0].label).toBe("力量");
    expect(next.pages[1].attributes[0].shortLabel).toBe("力");
    // 首页自身不变
    expect(next.pages[0].attributes[0].label).toBe("力量");
  });

  it("改表头全称 → 同步所有页面对应列", () => {
    const onChange = vi.fn();
    render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={onChange}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    const labelInputs = screen.getAllByPlaceholderText("全称");
    fireEvent.change(labelInputs[0], { target: { value: "力量全" } });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.pages.every((p: any) => p.attributes[0].label === "力量全")).toBe(true);
  });

  it("点行首数字 → onSetActive 命中该页", () => {
    const onSetActive = vi.fn();
    render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={vi.fn()}
        activePageIndex={0}
        onSetActive={onSetActive}
      />,
    );
    fireEvent.click(screen.getByText("2"));
    expect(onSetActive).toHaveBeenCalledWith(1);
  });

  it("数值输入框清空 → 视为 0", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={onChange}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    const numInputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(numInputs[0], { target: { value: "" } });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.pages[0].attributes[0].value).toBe(0);
  });

  it("◀ 交换第 1/0 列（非首列左移）", () => {
    const onChange = vi.fn();
    render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={onChange}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    const swapLefts = screen.getAllByTitle("与左侧列交换");
    fireEvent.click(swapLefts[1]); // 第 1 列的 ◀（非禁用）
    expect(onChange).toHaveBeenCalled();
  });

  it("聚焦后滚轮上滚 +1 调整数值", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={onChange}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    const input = container.querySelectorAll('input[type="number"]')[0] as HTMLInputElement;
    const before = makeMultiPageConfig().pages[0].attributes[0].value;
    input.focus();
    fireEvent.wheel(input, { deltaY: -1 });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.pages[0].attributes[0].value).toBe(before + 1);
  });

  it("滚轮 Shift=±10、Alt=±0.5、下滚为负", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={onChange}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    const input = container.querySelectorAll('input[type="number"]')[0] as HTMLInputElement;
    const before = makeMultiPageConfig().pages[0].attributes[0].value;
    input.focus();
    fireEvent.wheel(input, { deltaY: -1, shiftKey: true });
    expect(onChange.mock.calls.at(-1)![0].pages[0].attributes[0].value).toBe(before + 10);
    fireEvent.wheel(input, { deltaY: -1, altKey: true });
    expect(onChange.mock.calls.at(-1)![0].pages[0].attributes[0].value).toBe(before + 0.5);
    fireEvent.wheel(input, { deltaY: 1 });
    expect(onChange.mock.calls.at(-1)![0].pages[0].attributes[0].value).toBe(before - 1);
  });

  it("未聚焦时滚轮不触发 onChange", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={onChange}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    const input = container.querySelectorAll('input[type="number"]')[0] as HTMLInputElement;
    input.blur();
    fireEvent.wheel(input, { deltaY: -1 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("非活动行 focus/mousedown → onSetActive 命中该页", () => {
    const onSetActive = vi.fn();
    render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={vi.fn()}
        activePageIndex={0}
        onSetActive={onSetActive}
      />,
    );
    const rows = screen.getAllByRole("row").filter((r) => r.closest("tbody"));
    fireEvent.focus(rows[1]);
    expect(onSetActive).toHaveBeenCalledWith(1);
    onSetActive.mockClear();
    fireEvent.mouseDown(rows[1]);
    expect(onSetActive).toHaveBeenCalledWith(1);
  });

  it("活动行 focus/mousedown → 不重复 onSetActive", () => {
    const onSetActive = vi.fn();
    render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={vi.fn()}
        activePageIndex={0}
        onSetActive={onSetActive}
      />,
    );
    const rows = screen.getAllByRole("row").filter((r) => r.closest("tbody"));
    fireEvent.focus(rows[0]);
    fireEvent.mouseDown(rows[0]);
    expect(onSetActive).not.toHaveBeenCalled();
  });

  it("同步按钮带悬浮说明 tooltip", () => {
    render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={vi.fn()}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain("复制到其余所有页面");
  });

  it("传入 onAddPage → 显示「＋ 添加新页」并触发回调", () => {
    const onAddPage = vi.fn();
    render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={vi.fn()}
        activePageIndex={0}
        onSetActive={vi.fn()}
        onAddPage={onAddPage}
      />,
    );
    fireEvent.click(screen.getByText("＋ 添加新页"));
    expect(onAddPage).toHaveBeenCalled();
  });

  it("未传 onAddPage → 不渲染添加按钮", () => {
    render(
      <RadarValuesTable
        config={makeMultiPageConfig()}
        onChange={vi.fn()}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    expect(screen.queryByText("＋ 添加新页")).toBeNull();
  });

  it("视频页渲染只读占位行（label + 视频页标签）", () => {
    const mixed = {
      ...makeMultiPageConfig(),
      pages: [makeMultiPageConfig().pages[0], { ...defaultVideoPage, label: "视频页1" }],
    };
    render(
      <RadarValuesTable
        config={mixed}
        onChange={vi.fn()}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    expect(screen.getByText("视频页1")).toBeInTheDocument();
    expect(screen.getByText("视频页")).toBeInTheDocument();
  });

  it("视频页占位行序与页索引对齐（第 2 行为视频页）", () => {
    const mixed = {
      ...makeMultiPageConfig(),
      pages: [makeMultiPageConfig().pages[0], { ...defaultVideoPage, label: "视频页1" }],
    };
    render(
      <RadarValuesTable
        config={mixed}
        onChange={vi.fn()}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    const rows = screen.getAllByRole("row").filter((r) => r.closest("tbody"));
    expect(rows[1].textContent).toContain("视频页1");
  });

  it("全视频页（无雷达页）返回 null（无表头无法对齐）", () => {
    const { container } = render(
      <RadarValuesTable
        config={{ ...makeMultiPageConfig(), pages: [{ ...defaultVideoPage }] }}
        onChange={vi.fn()}
        activePageIndex={0}
        onSetActive={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
