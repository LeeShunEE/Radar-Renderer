/**
 * TaskStatusBadge 单元测试：各状态的颜色与文案分支。
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";

describe("TaskStatusBadge", () => {
  it.each([
    ["queued", "排队中", "yellow"],
    ["running", "渲染中", "blue"],
    ["done", "完成", "green"],
    ["failed", "失败", "red"],
    ["canceled", "已取消", "gray"],
  ])("状态 %s 显示文案 %s 且配色 %s", (status, text, color) => {
    const { container } = render(<TaskStatusBadge status={status} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(container.querySelector("span")?.className).toContain(color);
  });

  it("未知状态走 default 分支显示原始状态文本与 muted 配色", () => {
    const { container } = render(<TaskStatusBadge status="weird" />);
    expect(screen.getByText("weird")).toBeInTheDocument();
    expect(container.querySelector("span")?.className).toContain("muted");
  });
});
