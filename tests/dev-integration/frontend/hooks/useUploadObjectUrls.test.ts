/**
 * useUploadObjectUrls dev-integration 测试。
 *
 * 链路：useUploadObjectUrls → api-client(files.fetchUploadBlob) → MSW → URL.createObjectURL。
 * 验证首次请求返回 undefined（pending），Blob 拉取完成后缓存 objectURL。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUploadObjectUrls } from "@/hooks/useUploadObjectUrls";
import { seedAuth, resetAuth } from "../_helpers";

let urlCounter = 0;

beforeEach(() => {
  urlCounter = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:mock-${++urlCounter}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  seedAuth();
});

afterEach(() => {
  resetAuth();
  vi.restoreAllMocks();
});

describe("useUploadObjectUrls（集成）", () => {
  it("首次请求返回 undefined，Blob 就绪后缓存 objectURL", async () => {
    const { result } = renderHook(() => useUploadObjectUrls());

    let first: string | undefined;
    act(() => {
      first = result.current.getObjectUrl("avatar.png");
    });
    expect(first).toBeUndefined();

    await waitFor(() => {
      expect(result.current.cache["avatar.png"]).toBeTruthy();
    });

    // 缓存命中后同步返回 objectURL，不再触发新的 createObjectURL。
    const cached = result.current.getObjectUrl("avatar.png");
    expect(cached).toBe(result.current.cache["avatar.png"]);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("同名并发请求只发起一次 fetch", async () => {
    const { result } = renderHook(() => useUploadObjectUrls());

    act(() => {
      result.current.getObjectUrl("dup.png");
      // 第二次同步调用此时仍 pending，返回 undefined 不重复发起
      expect(result.current.getObjectUrl("dup.png")).toBeUndefined();
    });

    await waitFor(() => expect(result.current.cache["dup.png"]).toBeTruthy());
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
