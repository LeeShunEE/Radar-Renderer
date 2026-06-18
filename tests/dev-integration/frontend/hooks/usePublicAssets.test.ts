/**
 * usePublicAssets dev-integration 测试。
 *
 * 链路：usePublicAssets → api-client(assets) → MSW。不 mock api-client，
 * 真实 fetch 经 MSW 验证公共剪影/音乐列表拉取。公共资源端点无需鉴权。
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePublicAssets } from "@/hooks/usePublicAssets";
import { mswServer, http, HttpResponse } from "@/test/msw-server";
import { resetAuth } from "../_helpers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

describe("usePublicAssets（集成）", () => {
  afterEach(resetAuth);

  it("挂载后自动加载公共剪影与音乐列表", async () => {
    const { result } = renderHook(() => usePublicAssets());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.silhouettes.length).toBeGreaterThan(0);
      expect(result.current.music.length).toBeGreaterThan(0);
    });

    expect(result.current.silhouettes.map((s) => s.name)).toContain("hero.png");
    expect(result.current.music.map((m) => m.name)).toContain("bgm.mp3");
    expect(result.current.error).toBeNull();
  });

  it("refresh 重新拉取列表", async () => {
    const { result } = renderHook(() => usePublicAssets());
    await waitFor(() => expect(result.current.silhouettes.length).toBeGreaterThan(0));

    await result.current.refresh();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.silhouettes.length).toBeGreaterThan(0);
    });
  });

  it("getAssetUrl 拼出公共资源 URL", () => {
    const { result } = renderHook(() => usePublicAssets());
    const url = result.current.getAssetUrl("silhouettes", "hero.png");
    expect(url).toContain("/api/v1/assets/silhouettes/hero.png");
  });

  it("拉取失败时落入 error 态（HTTP 错误）", async () => {
    mswServer.use(
      http.get(`${API_BASE}/api/v1/assets/silhouettes`, () =>
        HttpResponse.json({ error: "服务异常", code: "server_error" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => usePublicAssets());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("服务异常");
    });
  });

  it("拉取抛出非 Error 时落入兜底错误消息", async () => {
    // 传输层抛出非 Error（字符串）→ 覆盖 e instanceof Error 的 false 分支。
    // MSW 会把 resolver 异常归一成 HTTP 响应，故此处直接桩 fetch 制造 transport 级 reject。
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue("network down");
    const { result } = renderHook(() => usePublicAssets());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("获取公共资源失败");
    });
    fetchSpy.mockRestore();
  });
});
