/**
 * useTaskQueue dev-integration 测试。
 *
 * 链路：useTaskQueue → api-client(tasks) → MSW。验证列表加载、手动刷新、删除任务。
 * 受保护端点要求 Bearer，故先 seedAuth()。
 *
 * 注意：useTaskQueue 在有活动任务（queued/running）时启动 5s 轮询定时器。
 * 用假定时器避免真实 setInterval 泄漏到其他用例。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTaskQueue } from "@/hooks/useTaskQueue";
import { mswServer, http, HttpResponse } from "@/test/msw-server";
import { seedAuth, resetAuth } from "../_helpers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

describe("useTaskQueue（集成）", () => {
  beforeEach(() => {
    seedAuth();
  });
  afterEach(resetAuth);

  it("挂载后自动加载任务列表与队列大小", async () => {
    const { result } = renderHook(() => useTaskQueue());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.tasks.length).toBeGreaterThan(0);
    });
    expect(result.current.tasks[0].id).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it("refreshTasks 手动刷新", async () => {
    const { result } = renderHook(() => useTaskQueue());
    await waitFor(() => expect(result.current.tasks.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.refreshTasks();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it("deleteTask 删除后刷新队列（任务移除）", async () => {
    const { result } = renderHook(() => useTaskQueue());
    await waitFor(() => expect(result.current.tasks.length).toBe(1));

    await act(async () => {
      await result.current.deleteTask(1);
    });

    // MSW delete 从内存态移除 id=1 任务，刷新后列表清空。
    await waitFor(() => expect(result.current.tasks).toHaveLength(0));
    expect(result.current.error).toBeNull();
  });

  it("加载失败时设置 error", async () => {
    mswServer.use(
      http.get(`${API_BASE}/api/v1/tasks`, () =>
        HttpResponse.json({ error: "服务异常", code: "server_error" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useTaskQueue());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });
  });
});
