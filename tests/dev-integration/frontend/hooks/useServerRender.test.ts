/**
 * useServerRender dev-integration 测试。
 *
 * 链路：useServerRender → api-client(render/tasks/files) + useTaskPolling → MSW。
 * 提交渲染 → 轮询任务态推进（queued → done）→ fetchOutputBlob 下载链路。
 * 用真实定时器驱动 useTaskPolling 的 2s 轮询（避免 MSW + 假定时器的 undici 冲突）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useServerRender } from "@/hooks/useServerRender";
import { mswServer, http, HttpResponse } from "@/test/msw-server";
import { seedAuth, resetAuth } from "../_helpers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const mockAnchorClick = vi.fn();
const originalCreateElement = document.createElement.bind(document);

/** 构造任务态响应（带轮询 hook 期望的全字段）。 */
function taskResponse(id: number, status: string, codec = "h264") {
  return {
    id,
    mode: "single",
    codec,
    status,
    input_props: {},
    output_path: status === "done" ? `/outputs/${id}.mp4` : "",
    error: status === "failed" ? "渲染出错" : null,
    duration_ms: status === "done" ? 1000 : null,
    created_at: "2026-01-01T00:00:00Z",
    started_at: null,
    finished_at: null,
    position: status === "queued" ? 1 : 0,
    eta_seconds: status === "queued" ? 30 : null,
  };
}

beforeEach(() => {
  seedAuth();
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "a") {
      return { href: "", download: "", click: mockAnchorClick } as unknown as HTMLAnchorElement;
    }
    return originalCreateElement(tag);
  });
});

afterEach(() => {
  resetAuth();
  vi.restoreAllMocks();
  mockAnchorClick.mockClear();
});

describe("useServerRender（集成）", () => {
  it("提交渲染 → 轮询推进至 done → 触发产物下载", async () => {
    // /render 返回 queued 任务；/tasks/:id 首拉 queued，后续 done（模拟队列推进）。
    let polls = 0;
    mswServer.use(
      http.post(`${API_BASE}/api/v1/render`, () =>
        HttpResponse.json(
          { id: 42, mode: "single", codec: "h264", status: "queued", input_props: {}, output_path: "", created_at: "2026-01-01T00:00:00Z" },
          { status: 201 },
        ),
      ),
      http.get(`${API_BASE}/api/v1/tasks/:taskId`, () => {
        polls += 1;
        return HttpResponse.json(taskResponse(42, polls === 1 ? "queued" : "done"));
      }),
    );

    const { result } = renderHook(() => useServerRender());

    await act(async () => {
      await result.current.submitRender("single", "h264", { characterName: "Hero" });
    });

    // 立即拉取一次 → queued
    await waitFor(() => expect(result.current.status).toBe("queued"));
    expect(result.current.currentTask?.id).toBe(42);

    // 2s 轮询推进至 done → 自动下载
    await waitFor(
      () => {
        expect(result.current.status).toBe("done");
      },
      { timeout: 6000 },
    );
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mockAnchorClick).toHaveBeenCalled();
  }, 10000);

  it("任务 failed 时状态变为 failed 并带错误", async () => {
    mswServer.use(
      http.post(`${API_BASE}/api/v1/render`, () =>
        HttpResponse.json(
          { id: 7, mode: "single", codec: "h264", status: "queued", input_props: {}, output_path: "", created_at: "2026-01-01T00:00:00Z" },
          { status: 201 },
        ),
      ),
      http.get(`${API_BASE}/api/v1/tasks/:taskId`, () =>
        HttpResponse.json(taskResponse(7, "failed")),
      ),
    );

    const { result } = renderHook(() => useServerRender());
    await act(async () => {
      await result.current.submitRender("single", "h264", {});
    });

    await waitFor(() => {
      expect(result.current.status).toBe("failed");
      expect(result.current.error).toBe("渲染出错");
    });
  });

  it("提交失败时状态为 failed", async () => {
    mswServer.use(
      http.post(`${API_BASE}/api/v1/render`, () =>
        HttpResponse.json({ error: "队列已满", code: "queue_full" }, { status: 503 }),
      ),
    );

    const { result } = renderHook(() => useServerRender());
    await act(async () => {
      await result.current.submitRender("single", "h264", {});
    });

    expect(result.current.status).toBe("failed");
    expect(result.current.error).toBeTruthy();
  });

  it("cancelRender 删除排队任务并回到 idle", async () => {
    mswServer.use(
      http.post(`${API_BASE}/api/v1/render`, () =>
        HttpResponse.json(
          { id: 9, mode: "single", codec: "h264", status: "queued", input_props: {}, output_path: "", created_at: "2026-01-01T00:00:00Z" },
          { status: 201 },
        ),
      ),
      http.get(`${API_BASE}/api/v1/tasks/:taskId`, () =>
        HttpResponse.json(taskResponse(9, "queued")),
      ),
    );

    const { result } = renderHook(() => useServerRender());
    await act(async () => {
      await result.current.submitRender("single", "h264", {});
    });
    await waitFor(() => expect(result.current.status).toBe("queued"));

    await act(async () => {
      await result.current.cancelRender();
    });

    expect(result.current.error).toBe("任务已取消");
  });
});
