/**
 * TaskQueuePanel dev-integration 测试。
 *
 * 链路：TaskQueuePanel → useTaskQueue → api-client(tasks) → MSW。render 真实组件，
 * 验证队列任务出现、删除任务后队列更新全链路。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { TaskQueuePanel } from "@/components/tasks/TaskQueuePanel";
import { seedAuth, resetAuth } from "../../_helpers";

// Mock ConfirmDialog 组件以避免 @base-ui/react/dialog 在测试环境的导入问题
vi.mock("@/components/ui/dialog", () => ({
  ConfirmDialog: ({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    danger,
    onConfirm,
  }: any) =>
    open ? (
      <div data-testid="confirm-dialog">
        <h2>{title}</h2>
        <p>{description}</p>
        <button
          data-testid="dialog-cancel"
          onClick={() => onOpenChange(false)}
        >
          取消
        </button>
        <button
          data-testid="dialog-confirm"
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

describe("TaskQueuePanel（集成）", () => {
  beforeEach(() => seedAuth());
  afterEach(resetAuth);

  it("render 后队列任务出现", async () => {
    render(<TaskQueuePanel />);

    // mockTask 含 id=1 的 queued 任务；组件按 #id 渲染
    await waitFor(() => {
      expect(screen.getByText(/#1/)).toBeInTheDocument();
    });
    // 队列状态文案
    expect(screen.getByText(/队列中/)).toBeInTheDocument();
  });

  it("删除任务后队列更新", async () => {
    render(<TaskQueuePanel />);
    await waitFor(() => expect(screen.getByText(/#1/)).toBeInTheDocument());

    // 点击删除按钮（最后一个按钮）
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);

    // 等待确认 Dialog 出现
    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    });

    // 点击确认按钮
    fireEvent.click(screen.getByTestId("dialog-confirm"));

    // 等待任务被删除
    await waitFor(() => {
      expect(screen.getByText("暂无渲染任务")).toBeInTheDocument();
    });
  });
});