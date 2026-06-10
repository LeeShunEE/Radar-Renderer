/**
 * useServerRender hook 单元测试：mock api-client，验证提交、状态更新、下载。
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useServerRender } from "@/hooks/useServerRender";
import { render as renderApi, tasks, files, TaskResponse } from "@/lib/api-client";

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

// Mock api-client modules
vi.mock("@/lib/api-client", () => ({
  render: {
    submit: vi.fn(),
  },
  tasks: {
    get: vi.fn(),
    delete: vi.fn(),
  },
  files: {
    fetchOutputBlob: vi.fn(),
  },
}));

// Create a mutable mock for useTaskPolling
const mockPollingResult = {
  task: null as TaskResponse | null,
  isPolling: false,
  error: null as string | null,
  start: vi.fn(),
  stop: vi.fn(),
};

vi.mock("@/hooks/useTaskPolling", () => ({
  useTaskPolling: () => mockPollingResult,
}));

// Mock document.createElement for download trigger
const originalCreateElement = document.createElement.bind(document);
const mockAnchorClick = vi.fn();
vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
  if (tagName === "a") {
    return {
      href: "",
      download: "",
      click: mockAnchorClick,
    } as unknown as HTMLAnchorElement;
  }
  return originalCreateElement(tagName);
});

// Mock URL.createObjectURL and revokeObjectURL
vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

describe("useServerRender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockAnchorClick.mockClear();
    // Reset polling mock state
    mockPollingResult.task = null;
    mockPollingResult.isPolling = false;
    mockPollingResult.error = null;
    mockPollingResult.start = vi.fn();
    mockPollingResult.stop = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("初始化状态", () => {
    it("初始化状态为 idle", () => {
      const { result } = renderHook(() => useServerRender());

      expect(result.current.status).toBe("idle");
      expect(result.current.currentTask).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe("submitRender", () => {
    it("submit 后状态变为 queued", async () => {
      vi.mocked(renderApi.submit).mockResolvedValueOnce({
        id: 1,
        mode: "single",
        codec: "h264",
        status: "queued",
        input_props: {},
        output_path: "",
        created_at: "2026-01-01T00:00:00Z",
      });

      const { result } = renderHook(() => useServerRender());

      await act(async () => {
        await result.current.submitRender("single", "h264", { characterName: "Test" });
      });

      expect(renderApi.submit).toHaveBeenCalledWith("single", "h264", { characterName: "Test" });
      expect(result.current.status).toBe("queued");
    });

    it("submit 失败时设置 error 并状态为 failed", async () => {
      vi.mocked(renderApi.submit).mockRejectedValueOnce(new Error("提交失败"));

      const { result } = renderHook(() => useServerRender());

      await act(async () => {
        await result.current.submitRender("single", "h264", {});
      });

      expect(result.current.status).toBe("failed");
      expect(result.current.error).toBe("提交失败");
    });

    it("submit 失败时非 Error 对象使用默认消息", async () => {
      vi.mocked(renderApi.submit).mockRejectedValueOnce("unknown error");

      const { result } = renderHook(() => useServerRender());

      await act(async () => {
        await result.current.submitRender("single", "h264", {});
      });

      expect(result.current.status).toBe("failed");
      expect(result.current.error).toBe("提交渲染失败");
    });
  });

  describe("状态更新（通过 useTaskPolling）", () => {
    it("任务 queued 时状态变为 queued", async () => {
      const queuedTask: TaskResponse = {
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
      };

      // 设置 polling 返回 queued 任务
      mockPollingResult.task = queuedTask;
      mockPollingResult.isPolling = true;

      const { result } = renderHook(() => useServerRender());

      await waitFor(() => {
        expect(result.current.status).toBe("queued");
        expect(result.current.currentTask).toEqual(queuedTask);
      });
    });

    it("任务 running 时状态变为 rendering", async () => {
      const runningTask: TaskResponse = {
        id: 1,
        mode: "single",
        codec: "h264",
        status: "running",
        input_props: {},
        output_path: "",
        error: null,
        duration_ms: null,
        created_at: "2026-01-01T00:00:00Z",
        started_at: "2026-01-01T00:00:01Z",
        finished_at: null,
        position: 0,
        eta_seconds: 30,
      };

      // 设置 polling 返回 running 任务
      mockPollingResult.task = runningTask;
      mockPollingResult.isPolling = true;

      const { result } = renderHook(() => useServerRender());

      await waitFor(() => {
        expect(result.current.status).toBe("rendering");
        expect(result.current.currentTask).toEqual(runningTask);
      });
    });

    it("任务 done 时触发下载", async () => {
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

      vi.mocked(files.fetchOutputBlob).mockResolvedValueOnce(new Blob(["mock video data"]));

      // 设置 polling 返回 done 任务
      mockPollingResult.task = doneTask;
      mockPollingResult.isPolling = false;

      const { result } = renderHook(() => useServerRender());

      // 等待下载完成
      await waitFor(() => {
        expect(files.fetchOutputBlob).toHaveBeenCalledWith(1);
        expect(mockAnchorClick).toHaveBeenCalled();
        expect(result.current.status).toBe("done");
      });
    });

    it("任务 failed 时状态变为 failed 并设置 error", async () => {
      const failedTask: TaskResponse = {
        id: 1,
        mode: "single",
        codec: "h264",
        status: "failed",
        input_props: {},
        output_path: "",
        error: "渲染出错",
        duration_ms: null,
        created_at: "2026-01-01T00:00:00Z",
        started_at: "2026-01-01T00:00:01Z",
        finished_at: "2026-01-01T00:00:02Z",
        position: 0,
        eta_seconds: null,
      };

      // 设置 polling 返回 failed 任务
      mockPollingResult.task = failedTask;
      mockPollingResult.isPolling = false;

      const { result } = renderHook(() => useServerRender());

      await waitFor(() => {
        expect(result.current.status).toBe("failed");
        expect(result.current.error).toBe("渲染出错");
      });
    });

    it("任务 canceled 时状态变为 idle", async () => {
      const canceledTask: TaskResponse = {
        id: 1,
        mode: "single",
        codec: "h264",
        status: "canceled",
        input_props: {},
        output_path: "",
        error: null,
        duration_ms: null,
        created_at: "2026-01-01T00:00:00Z",
        started_at: null,
        finished_at: null,
        position: 0,
        eta_seconds: null,
      };

      // 设置 polling 返回 canceled 任务
      mockPollingResult.task = canceledTask;
      mockPollingResult.isPolling = false;

      const { result } = renderHook(() => useServerRender());

      await waitFor(() => {
        expect(result.current.status).toBe("idle");
        expect(result.current.error).toBe("任务已取消");
      });
    });
  });

  describe("cancelRender", () => {
    it("取消任务时调用 delete API", async () => {
      const task: TaskResponse = {
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
      };

      vi.mocked(tasks.delete).mockResolvedValueOnce(undefined);

      // 设置 polling 有任务
      mockPollingResult.task = task;
      mockPollingResult.isPolling = true;

      const { result } = renderHook(() => useServerRender());

      // 等待 useEffect 处理完初始状态
      await waitFor(() => {
        expect(result.current.status).toBe("queued");
      });

      // 执行取消
      await act(async () => {
        await result.current.cancelRender();
      });

      // 取消后需要清除 polling task 以防止 useEffect 再次设置状态
      mockPollingResult.task = null;

      expect(tasks.delete).toHaveBeenCalledWith(1);
      expect(result.current.error).toBe("任务已取消");
    });

    it("取消失败时设置 error", async () => {
      const task: TaskResponse = {
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
      };

      vi.mocked(tasks.delete).mockRejectedValueOnce(new Error("取消失败"));

      // 设置 polling 有任务
      mockPollingResult.task = task;
      mockPollingResult.isPolling = true;

      const { result } = renderHook(() => useServerRender());

      await act(async () => {
        await result.current.cancelRender();
      });

      expect(result.current.error).toBe("取消失败");
    });

    it("无任务时 cancelRender 不调用 API", async () => {
      // 设置 polling 无任务
      mockPollingResult.task = null;
      mockPollingResult.isPolling = false;

      const { result } = renderHook(() => useServerRender());

      await act(async () => {
        await result.current.cancelRender();
      });

      expect(tasks.delete).not.toHaveBeenCalled();
    });
  });

  describe("下载产物", () => {
    it("下载 h264 产物生成 mp4 文件名", async () => {
      const doneTask: TaskResponse = {
        id: 123,
        mode: "single",
        codec: "h264",
        status: "done",
        input_props: {},
        output_path: "/outputs/123.mp4",
        error: null,
        duration_ms: 1000,
        created_at: "2026-01-01T00:00:00Z",
        started_at: "2026-01-01T00:00:01Z",
        finished_at: "2026-01-01T00:00:02Z",
        position: 0,
        eta_seconds: null,
      };

      vi.mocked(files.fetchOutputBlob).mockResolvedValueOnce(new Blob(["mock video"]));

      mockPollingResult.task = doneTask;
      mockPollingResult.isPolling = false;

      const { result } = renderHook(() => useServerRender());

      await waitFor(() => {
        expect(result.current.status).toBe("done");
        expect(files.fetchOutputBlob).toHaveBeenCalledWith(123);
        expect(mockAnchorClick).toHaveBeenCalled();
      });
    });

    it("下载 gif 产物生成 gif 文件名", async () => {
      const doneTask: TaskResponse = {
        id: 456,
        mode: "single",
        codec: "gif",
        status: "done",
        input_props: {},
        output_path: "/outputs/456.gif",
        error: null,
        duration_ms: 1000,
        created_at: "2026-01-01T00:00:00Z",
        started_at: "2026-01-01T00:00:01Z",
        finished_at: "2026-01-01T00:00:02Z",
        position: 0,
        eta_seconds: null,
      };

      vi.mocked(files.fetchOutputBlob).mockResolvedValueOnce(new Blob(["mock gif"]));

      mockPollingResult.task = doneTask;
      mockPollingResult.isPolling = false;

      const { result } = renderHook(() => useServerRender());

      await waitFor(() => {
        expect(result.current.status).toBe("done");
        expect(files.fetchOutputBlob).toHaveBeenCalledWith(456);
      });
    });

    it("下载失败时状态变为 failed", async () => {
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

      // Mock blob fetch to reject using mockImplementation to ensure it rejects
      vi.mocked(files.fetchOutputBlob).mockImplementation(() =>
        Promise.reject(new Error("下载失败"))
      );

      // 设置 polling 返回 done 任务以触发下载
      mockPollingResult.task = doneTask;
      mockPollingResult.isPolling = false;

      const { result } = renderHook(() => useServerRender());

      // 等待下载开始（状态变为 downloading）
      await waitFor(() => {
        expect(result.current.status).toBe("downloading");
      });

      // 等待下载失败
      await waitFor(
        () => {
          expect(result.current.status).toBe("failed");
          expect(result.current.error).toBe("下载失败");
        },
        { timeout: 3000 }
      );
    });
  });

  describe("polling error 合并", () => {
    it("polling error 与 render error 合并", async () => {
      const pollingError = "轮询超时";

      mockPollingResult.error = pollingError;
      mockPollingResult.task = null;
      mockPollingResult.isPolling = false;

      const { result } = renderHook(() => useServerRender());

      expect(result.current.error).toBe(pollingError);
    });

    it("render error 优先于 polling error", async () => {
      const renderError = "渲染错误";

      mockPollingResult.error = "轮询超时";
      mockPollingResult.task = null;

      const { result } = renderHook(() => useServerRender());

      // 设置 render error
      vi.mocked(renderApi.submit).mockRejectedValueOnce(new Error(renderError));

      await act(async () => {
        await result.current.submitRender("single", "h264", {});
      });

      // render error 应该优先
      expect(result.current.error).toBe(renderError);
    });
  });
});