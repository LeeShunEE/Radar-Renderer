/**
 * ImportFromMenu 单元测试：空源返回 null + 触发器文案 + 选项点击触发 onPick。
 * base-ui Popover 在 jsdom 走真实交互（点触发器打开 → 点选项），不依赖 mock 拦截。
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImportFromMenu, type ImportSource } from "@/components/editor/ImportFromMenu";

const sources: ImportSource[] = [
  { index: 0, label: "首页" },
  { index: 2, label: "" },
];

describe("ImportFromMenu", () => {
  it("无源时返回 null", () => {
    const { container } = render(<ImportFromMenu sources={[]} onPick={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("渲染触发器默认文案", () => {
    render(<ImportFromMenu sources={sources} onPick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /从某一页面导入/ })).toBeInTheDocument();
  });

  it("自定义触发器文案", () => {
    render(
      <ImportFromMenu sources={sources} onPick={vi.fn()} triggerLabel="导入自此" />,
    );
    expect(screen.getByRole("button", { name: /导入自此/ })).toBeInTheDocument();
  });

  it("点击触发器打开后，点选项触发 onPick", async () => {
    const onPick = vi.fn();
    render(<ImportFromMenu sources={sources} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /从某一页面导入/ }));
    // base-ui Close 渲染为按钮，选项文本含 label；popup 走 portal 进 document.body
    const option = await screen.findByText("首页", { exact: false });
    fireEvent.click(option);
    expect(onPick).toHaveBeenCalledWith(0);
  });

  it("label 为空时回退到「页N」", async () => {
    render(<ImportFromMenu sources={sources} onPick={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /从某一页面导入/ }));
    // index=2 → 页3
    const option = await screen.findByText("页3", { exact: false });
    expect(option).toBeInTheDocument();
  });
});
