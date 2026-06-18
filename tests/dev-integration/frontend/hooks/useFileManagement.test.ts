/**
 * useFileManagement dev-integration 测试。
 *
 * 链路：useFileManagement → api-client(files) → MSW。不 mock api-client，
 * 真实 fetch 经 MSW 验证列表/上传/删除/下载全链路 + 401 未鉴权错误态。
 * 受保护端点要求 Bearer，故鉴权用例先 seedAuth()。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFileManagement } from "@/hooks/useFileManagement";
import { mswServer, http, HttpResponse } from "@/test/msw-server";
import { seedAuth, resetAuth } from "../_helpers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// jsdom 未实现 URL.createObjectURL / anchor 下载，下载链路统一打桩。
const mockAnchorClick = vi.fn();
const originalCreateElement = document.createElement.bind(document);

beforeEach(() => {
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

describe("useFileManagement（集成）", () => {
  it("挂载后自动加载文件列表与配额", async () => {
    seedAuth();
    const { result } = renderHook(() => useFileManagement());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.files.length).toBeGreaterThan(0);
    });

    expect(result.current.quota).not.toBeNull();
    expect(result.current.files[0].name).toBe("silhouette.png");
    expect(result.current.error).toBeNull();
  });

  it("upload 成功后自动刷新列表（新增文件出现）", async () => {
    seedAuth();
    const { result } = renderHook(() => useFileManagement());
    await waitFor(() => expect(result.current.files.length).toBe(1));

    await act(async () => {
      await result.current.upload(new File(["data"], "new.png", { type: "image/png" }));
    });

    await waitFor(() => {
      expect(result.current.uploading).toBe(false);
      expect(result.current.files.map((f) => f.name)).toContain("uploaded.png");
    });
  });

  it("delete 成功后从列表移除并自动刷新", async () => {
    seedAuth();
    const { result } = renderHook(() => useFileManagement());
    await waitFor(() => expect(result.current.files.length).toBe(1));

    await act(async () => {
      await result.current.deleteFile("silhouette.png");
    });

    // MSW delete handler 从内存态移除该项，刷新后列表清空。
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.files).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });
  });

  it("downloadFile 拉取 Blob 并触发浏览器保存", async () => {
    seedAuth();
    const { result } = renderHook(() => useFileManagement());
    await waitFor(() => expect(result.current.files.length).toBe(1));

    await act(async () => {
      await result.current.downloadFile("silhouette.png");
    });

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mockAnchorClick).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("未鉴权时列表加载落入 401 错误态", async () => {
    // 不 seedAuth：MSW /files 无 Bearer 返回 401，且无 refresh token 不重试。
    const { result } = renderHook(() => useFileManagement());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });
    expect(result.current.files).toHaveLength(0);
  });

  it("getDownloadUrl 返回上传文件直链", () => {
    seedAuth();
    const { result } = renderHook(() => useFileManagement());
    expect(result.current.getDownloadUrl("a.png")).toContain("/api/v1/files/uploads/a.png");
  });

  it("formatQuota 与 quotaPercent 正常计算", async () => {
    seedAuth();
    const { result } = renderHook(() => useFileManagement());
    await waitFor(() => expect(result.current.quota).not.toBeNull());

    expect(result.current.formatQuota(512)).toBe("512 B");
    expect(result.current.formatQuota(2048)).toBe("2.0 KB");
    expect(result.current.formatQuota(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(result.current.formatQuota(3 * 1024 * 1024 * 1024)).toBe("3.00 GB");
    expect(result.current.quotaPercent).toBeGreaterThanOrEqual(0);
  });

  it("upload 失败时落入 error 态并抛出", async () => {
    seedAuth();
    mswServer.use(
      http.post(`${API_BASE}/api/v1/files`, () =>
        HttpResponse.json({ error: "文件过大", code: "too_large" }, { status: 413 }),
      ),
    );
    const { result } = renderHook(() => useFileManagement());
    await waitFor(() => expect(result.current.files.length).toBe(1));

    let threw = false;
    await act(async () => {
      try {
        await result.current.upload(new File(["d"], "big.png"));
      } catch {
        threw = true;
      }
    });
    expect(threw).toBe(true);

    await waitFor(() => {
      expect(result.current.uploading).toBe(false);
      expect(result.current.error).toBe("文件过大");
    });
  });

  it("deleteFile 失败时落入 error 态", async () => {
    seedAuth();
    mswServer.use(
      http.delete(`${API_BASE}/api/v1/files/:name`, () =>
        HttpResponse.json({ error: "无权删除", code: "forbidden" }, { status: 403 }),
      ),
    );
    const { result } = renderHook(() => useFileManagement());
    await waitFor(() => expect(result.current.files.length).toBe(1));

    await act(async () => {
      try {
        await result.current.deleteFile("silhouette.png");
      } catch {
        // 错误已在 hook 内落入 error 态
      }
    });

    await waitFor(() => {
      expect(result.current.error).toBe("无权删除");
    });
  });

  it("downloadFile 失败时落入 error 态", async () => {
    seedAuth();
    mswServer.use(
      http.get(`${API_BASE}/api/v1/files/uploads/:name`, () =>
        HttpResponse.json({ error: "not found" }, { status: 404 }),
      ),
    );
    const { result } = renderHook(() => useFileManagement());
    await waitFor(() => expect(result.current.files.length).toBe(1));

    await act(async () => {
      await result.current.downloadFile("missing.png");
    });

    expect(result.current.error).toContain("HTTP 404");
    expect(mockAnchorClick).not.toHaveBeenCalled();
  });
});
