/**
 * useUploadObjectUrls hook 单元测试：mock files.fetchUploadBlob，验证缓存/去重/失败。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUploadObjectUrls } from "@/hooks/useUploadObjectUrls";
import { files } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  files: { fetchUploadBlob: vi.fn() },
}));

global.URL.createObjectURL = vi.fn((b: Blob) => `blob:${(b as { size?: number }).size ?? 0}`);
global.URL.revokeObjectURL = vi.fn();

describe("useUploadObjectUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("首次请求返回 undefined 并触发 fetch，完成后缓存 URL", async () => {
    vi.mocked(files.fetchUploadBlob).mockResolvedValue(new Blob(["data"], { type: "text/plain" }));

    const { result } = renderHook(() => useUploadObjectUrls());

    const first = result.current.getObjectUrl("a.png");
    expect(first).toBeUndefined();
    expect(files.fetchUploadBlob).toHaveBeenCalledWith("a.png");

    await waitFor(() => {
      expect(result.current.cache["a.png"]).toBeDefined();
    });
    expect(result.current.cache["a.png"]).toMatch(/^blob:/);

    // 第二次直接返回缓存，不再 fetch
    const second = result.current.getObjectUrl("a.png");
    expect(second).toBe(result.current.cache["a.png"]);
    expect(files.fetchUploadBlob).toHaveBeenCalledTimes(1);
  });

  it("请求进行中重复调用返回 undefined 且不重复 fetch", async () => {
    let resolveFetch!: (b: Blob) => void;
    vi.mocked(files.fetchUploadBlob).mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve; }),
    );

    const { result } = renderHook(() => useUploadObjectUrls());

    const first = result.current.getObjectUrl("a.png");
    const second = result.current.getObjectUrl("a.png");

    expect(first).toBeUndefined();
    expect(second).toBeUndefined();
    expect(files.fetchUploadBlob).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(new Blob(["data"]));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.cache["a.png"]).toBeDefined();
  });

  it("fetch 失败时清理 pending 且不写缓存", async () => {
    vi.mocked(files.fetchUploadBlob).mockRejectedValue(new Error("401"));

    const { result } = renderHook(() => useUploadObjectUrls());

    const first = result.current.getObjectUrl("bad.png");
    expect(first).toBeUndefined();

    await waitFor(() => {
      expect(files.fetchUploadBlob).toHaveBeenCalledTimes(1);
    });
    // 让 rejected promise 的 catch 跑完
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.cache["bad.png"]).toBeUndefined();

    // 失败后再次调用应重新发起请求（pending 已清理）
    const again = result.current.getObjectUrl("bad.png");
    expect(again).toBeUndefined();
    expect(files.fetchUploadBlob).toHaveBeenCalledTimes(2);
  });
});
