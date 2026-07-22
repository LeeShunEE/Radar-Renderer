import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalConfigEditor } from "@/components/editor/GlobalConfigEditor";
import {
  duplicatePageInSequence,
  removePageFromSequence,
  reorderPageSequence,
} from "@/lib/page-sequence";
import { defaultMultiPageConfig, defaultRadarProps } from "@/types/constants";

vi.mock("@/components/editor/GlobalOverridePanel", () => ({
  GlobalOverridePanel: () => null,
}));

function Harness() {
  const [config, setConfig] = useState({
    ...defaultMultiPageConfig,
    pages: [
      { ...defaultRadarProps, characterName: "甲" },
      { ...defaultRadarProps, characterName: "乙" },
    ],
    comparisons: [],
  });
  const [activePageIndex, setActivePageIndex] = useState(0);

  return (
    <GlobalConfigEditor
      config={config}
      activePageIndex={activePageIndex}
      onChange={setConfig}
      onSetActive={setActivePageIndex}
      onAddPage={() => undefined}
      onDuplicatePage={(pageIndex) => {
        const result = duplicatePageInSequence(config, pageIndex);
        setConfig({
          ...config,
          pages: result.pages,
          comparisons: result.comparisons,
        });
      }}
      onRemovePage={(pageIndex) => {
        const result = removePageFromSequence(
          config,
          activePageIndex,
          pageIndex,
        );
        setConfig({
          ...config,
          pages: result.pages,
          comparisons: result.comparisons,
        });
        setActivePageIndex(result.activePageIndex);
      }}
      onReorderPageSequence={(activeId, overId) => {
        const result = reorderPageSequence(
          config,
          activePageIndex,
          activeId,
          overId,
        );
        setConfig({
          ...config,
          pages: result.pages,
          comparisons: result.comparisons,
        });
        setActivePageIndex(result.activePageIndex);
      }}
      onPreviewAll={() => undefined}
    />
  );
}

describe("GlobalConfigEditor 页面编排状态链路", () => {
  it("建立对比、复制组内页、删除组内页后保持配置与 UI 一致", () => {
    render(<Harness />);

    fireEvent.click(
      screen.getByRole("button", { name: "将 甲 与 乙 设为对比" }),
    );
    expect(
      screen.getByRole("group", { name: "对比绑定：甲 与 乙" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开时长明细" }));
    expect(screen.getByText(/对比组 · 页 1 甲 \+ 页 2 乙/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "复制 甲" }));
    expect(screen.getAllByRole("button", { name: /^选择页面/ })).toHaveLength(
      3,
    );
    expect(
      screen.getByRole("group", { name: "对比绑定：甲 与 乙" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "删除 甲" })[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    expect(screen.queryByRole("group", { name: /对比绑定/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^选择页面/ })).toHaveLength(
      2,
    );
  });
});
