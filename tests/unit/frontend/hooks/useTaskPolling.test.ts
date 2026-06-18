/**
 * useTaskPolling hook 单元测试：mock api-client.tasks.get + 假定时器，验证轮询/终态停止/错误/清理。
 *
 * 注意：start() 内会同时「立即 fetchTask（异步）」+「setInterval（2s 假定时器）」。
 * 不能用 vi.runAllTimersAsync()——它会对 interval 无限递归。改用 flushMicrotasks()
 * 推进立即拉取的 Promise，用 advanceTimersByTimeAsync 推进单个间隔 tick。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTaskPolling } from "@/hooks/useTaskPolling";
import { tasks, TaskResponse } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  tasks: { get: vi.fn() },
}));

const baseTask = (status: string): TaskResponse => ({
  id: 1,
  mode: "single",
  codec: "h264",
  status,
  input_props: {},
  output_path: "",
  error: null,
  duration_ms: null,
  created_at: "2026-01-01T00:00:00Z",
  started_at: null,
  finished_at: null,
  position: 0,
  eta_seconds: 30,
});

/** 推进微任务队列（让 start() 的立即 fetchTask Promise 链跑完），不触碰 interval 定时器。 */
async function flushMicrotasks(times = 3) {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

describe("useTaskPolling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("start 立即拉取一次并进入轮询", async () => {
    vi.mocked(tasks.get).mockResolvedValue(baseTask("running"));

    const { result } = renderHook(() => useTaskPolling());

    act(() => {
      result.current.start(1);
    });
    await act(async () => {
      await flushMicrotasks();
    });

    expect(result.current.task?.status).toBe("running");
    expect(result.current.isPolling).toBe(true);
    expect(result.current.error).toBeNull();
    expect(tasks.get).toHaveBeenCalledTimes(1);
  });

  it("运行中任务随间隔持续轮询", async () => {
    vi.mocked(tasks.get).mockResolvedValue(baseTask("running"));

    const { result } = renderHook(() => useTaskPolling());

    act(() => result.current.start(1));
    await act(async () => {
      await flushMicrotasks();
    });
    expect(tasks.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(tasks.get).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(tasks.get).toHaveBeenCalledTimes(3);
  });

  it.each(["done", "failed", "canceled"])("终态 %s 自动停止轮询", async (status) => {
    vi.mocked(tasks.get).mockResolvedValue(baseTask(status));

    const { result } = renderHook(() => useTaskPolling());

    act(() => result.current.start(1));
    await act(async () => {
      await flushMicrotasks();
    });

    expect(result.current.task?.status).toBe(status);
    expect(result.current.isPolling).toBe(false);

    // 停止后推进时间不再轮询
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(tasks.get).toHaveBeenCalledTimes(1);
  });

  it("拉取失败时设置 error 并停止", async () => {
    vi.mocked(tasks.get).mockRejectedValue(new Error("timeout"));

    const { result } = renderHook(() => useTaskPolling());

    act(() => result.current.start(1));
    await act(async () => {
      await flushMicrotasks();
    });

    expect(result.current.error).toBe("timeout");
    expect(result.current.isPolling).toBe(false);
  });

  it("拉取失败时非 Error 对象使用默认消息", async () => {
    vi.mocked(tasks.get).mockRejectedValue("boom");

    const { result } = renderHook(() => useTaskPolling());

    act(() => result.current.start(1));
    await act(async () => {
      await flushMicrotasks();
    });

    expect(result.current.error).toBe("获取任务状态失败");
  });

  it("stop 手动停止并清除轮询", async () => {
    vi.mocked(tasks.get).mockResolvedValue(baseTask("running"));

    const { result } = renderHook(() => useTaskPolling());

    act(() => result.current.start(1));
    await act(async () => {
      await flushMicrotasks();
    });

    act(() => result.current.stop());
    expect(result.current.isPolling).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(tasks.get).toHaveBeenCalledTimes(1);
  });

  it("卸载时清理定时器", async () => {
    vi.mocked(tasks.get).mockResolvedValue(baseTask("running"));

    const { result, unmount } = renderHook(() => useTaskPolling());

    act(() => result.current.start(1));
    await act(async () => {
      await flushMicrotasks();
    });

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    // 卸载后不应再触发轮询
    expect(tasks.get).toHaveBeenCalledTimes(1);
  });
});
