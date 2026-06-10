/**
 * useTaskQueue hook 单元测试：mock api-client.tasks，验证初始化、刷新、删除。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTaskQueue } from "@/hooks/useTaskQueue";
import { tasks, TaskResponse } from "@/lib/api-client";

// Mock tasks module
vi.mock("@/lib/api-client", () => ({
  tasks: {
    list: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock localStorage for api-client token helpers
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock });

describe("useTaskQueue", () => {
  const mockTasks: TaskResponse[] = [
    {
      id: 1,
      mode: "single",
      codec: "h264",
      status: "queued",
      input_props: {},
      output_path: "",
      error: null,
      duration_ms: null,
      created_at: "2026-01-01T00:00:00Z",
      started_at: null,
      finished_at: null,
      position: 0,
      eta_seconds: 30,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("初始化状态", () => {
    it("初始化时返回空队列", async () => {
      // 设置默认 mock
      vi.mocked(tasks.list).mockResolvedValue({ queue_size: 0, tasks: [] });

      const { result } = renderHook(() => useTaskQueue());

      // 等待初始加载完成
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tasks).toEqual([]);
      expect(result.current.queueSize).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("初始化时自动调用 refreshTasks", async () => {
      vi.mocked(tasks.list).mockResolvedValue({ queue_size: 0, tasks: [] });

      renderHook(() => useTaskQueue());

      await waitFor(() => {
        expect(tasks.list).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("refreshTasks", () => {
    it("refresh 后更新任务列表", async () => {
      // 先返回空列表作为初始加载
      vi.mocked(tasks.list)
        .mockResolvedValueOnce({ queue_size: 0, tasks: [] })
        // 第二次返回有任务
        .mockResolvedValueOnce({ queue_size: 1, tasks: mockTasks });

      const { result } = renderHook(() => useTaskQueue());

      // 等待初始加载完成
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.tasks).toHaveLength(0);
      });

      // 手动调用 refreshTasks
      await act(async () => {
        await result.current.refreshTasks();
      });

      expect(result.current.tasks).toEqual(mockTasks);
      expect(result.current.queueSize).toBe(1);
      expect(result.current.loading).toBe(false);
    });

    it("refresh 过程中 loading 状态正确切换", async () => {
      // 先返回空列表作为初始加载
      vi.mocked(tasks.list).mockResolvedValueOnce({ queue_size: 0, tasks: [] });

      const { result } = renderHook(() => useTaskQueue());

      // 等待初始加载完成
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 设置一个延迟响应来观察 loading 状态
      vi.mocked(tasks.list).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve({ queue_size: 1, tasks: mockTasks }), 50))
      );

      // 开始刷新
      let refreshPromise: Promise<void>;
      act(() => {
        refreshPromise = result.current.refreshTasks();
      });

      // 应该立即进入 loading 状态
      expect(result.current.loading).toBe(true);

      // 等待完成
      await act(async () => {
        await refreshPromise;
      });

      expect(result.current.loading).toBe(false);
    });

    it("refresh 失败时设置 error", async () => {
      // 先返回空列表作为初始加载
      vi.mocked(tasks.list)
        .mockResolvedValueOnce({ queue_size: 0, tasks: [] })
        .mockRejectedValueOnce(new Error("网络错误"));

      const { result } = renderHook(() => useTaskQueue());

      // 等待初始加载完成
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 触发失败的刷新
      await act(async () => {
        await result.current.refreshTasks();
      });

      expect(result.current.error).toBe("网络错误");
    });

    it("refresh 失败时非 Error 对象使用默认消息", async () => {
      // 先返回空列表作为初始加载
      vi.mocked(tasks.list)
        .mockResolvedValueOnce({ queue_size: 0, tasks: [] })
        .mockRejectedValueOnce("unknown error");

      const { result } = renderHook(() => useTaskQueue());

      // 等待初始加载完成
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshTasks();
      });

      expect(result.current.error).toBe("获取任务列表失败");
    });
  });

  describe("deleteTask", () => {
    it("deleteTask 调用 API 并刷新列表", async () => {
      // 先返回空列表作为初始加载
      vi.mocked(tasks.list)
        .mockResolvedValueOnce({ queue_size: 0, tasks: [] })
        .mockResolvedValueOnce({ queue_size: 0, tasks: [] });
      vi.mocked(tasks.delete).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useTaskQueue());

      // 等待初始加载完成
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteTask(1);
      });

      expect(tasks.delete).toHaveBeenCalledWith(1);
      // 删除后会调用 refreshTasks，所以 list 被调用两次
      expect(tasks.list).toHaveBeenCalledTimes(2);
    });

    it("deleteTask 失败时设置 error", async () => {
      // 先返回空列表作为初始加载
      vi.mocked(tasks.list).mockResolvedValueOnce({ queue_size: 0, tasks: [] });
      vi.mocked(tasks.delete).mockRejectedValueOnce(new Error("删除失败"));

      const { result } = renderHook(() => useTaskQueue());

      // 等待初始加载完成
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteTask(1);
      });

      expect(result.current.error).toBe("删除失败");
    });

    it("deleteTask 失败时非 Error 对象使用默认消息", async () => {
      // 先返回空列表作为初始加载
      vi.mocked(tasks.list).mockResolvedValueOnce({ queue_size: 0, tasks: [] });
      vi.mocked(tasks.delete).mockRejectedValueOnce({});

      const { result } = renderHook(() => useTaskQueue());

      // 等待初始加载完成
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteTask(1);
      });

      expect(result.current.error).toBe("删除任务失败");
    });
  });

  describe("轮询行为", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("有活动任务时自动轮询", async () => {
      const activeTask: TaskResponse = {
        id: 1,
        mode: "single",
        codec: "h264",
        status: "running",
        input_props: {},
        output_path: "",
        error: null,
        duration_ms: null,
        created_at: "2026-01-01T00:00:00Z",
        started_at: null,
        finished_at: null,
        position: 0,
        eta_seconds: 30,
      };

      // 初始加载返回活动任务
      vi.mocked(tasks.list)
        .mockResolvedValueOnce({ queue_size: 1, tasks: [activeTask] })
        .mockResolvedValueOnce({ queue_size: 1, tasks: [activeTask] });

      const { result } = renderHook(() => useTaskQueue());

      // 等待初始加载完成（需要等待 Promise）
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.tasks).toHaveLength(1);
      expect(tasks.list).toHaveBeenCalledTimes(1);

      // 推进时间触发轮询（5s）
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      // 轮询应该触发第二次调用
      expect(tasks.list).toHaveBeenCalledTimes(2);
    });

    it("全部终态任务时停止轮询", async () => {
      const doneTask: TaskResponse = {
        id: 1,
        mode: "single",
        codec: "h264",
        status: "done",
        input_props: {},
        output_path: "/outputs/1.mp4",
        error: null,
        duration_ms: 1000,
        created_at: "2026-01-01T00:00:00Z",
        started_at: "2026-01-01T00:00:01Z",
        finished_at: "2026-01-01T00:00:02Z",
        position: 0,
        eta_seconds: null,
      };

      // 初始加载返回终态任务
      vi.mocked(tasks.list).mockResolvedValueOnce({ queue_size: 0, tasks: [doneTask] });

      const { result } = renderHook(() => useTaskQueue());

      // 等待初始加载完成
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.tasks).toHaveLength(1);

      // 推进时间 - 应该不会触发新的轮询
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });

      // 仍然只有 1 次调用（初始加载）
      expect(tasks.list).toHaveBeenCalledTimes(1);
    });
  });
});