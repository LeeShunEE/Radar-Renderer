/**
 * TaskQueuePanel dev-integration 测试。
 *
 * 链路：TaskQueuePanel → useTaskQueue → api-client(tasks) → MSW。render 真实组件，
 * 验证队列任务出现、删除任务后队列更新全链路。
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { TaskQueuePanel } from "@/components/tasks/TaskQueuePanel";
import { seedAuth, resetAuth } from "../../_helpers";

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

    // 图标按钮无 accessible name，按 DOM 顺序定位：[刷新, 删除]（queued 无下载按钮）。
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText("暂无渲染任务")).toBeInTheDocument();
    });
  });
});
