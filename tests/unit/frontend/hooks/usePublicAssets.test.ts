/**
 * usePublicAssets hook 单元测试：mock api-client.assets，验证加载 silhouettes/music。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePublicAssets } from "@/hooks/usePublicAssets";
import { assets } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  assets: {
    listSilhouettes: vi.fn(),
    listMusic: vi.fn(),
    url: vi.fn(),
  },
}));

const silhouettes = [{ name: "hero.png", path: "silhouettes/hero.png", size_bytes: 1 }];
const music = [{ name: "bgm.mp3", path: "music/bgm.mp3", size_bytes: 2 }];

describe("usePublicAssets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assets.listSilhouettes).mockResolvedValue(silhouettes);
    vi.mocked(assets.listMusic).mockResolvedValue(music);
    vi.mocked(assets.url).mockImplementation((cat, name) => `http://api/${cat}/${name}`);
  });

  it("挂载时并行加载 silhouettes 与 music", async () => {
    const { result } = renderHook(() => usePublicAssets());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.silhouettes).toEqual(silhouettes);
    expect(result.current.music).toEqual(music);
    expect(result.current.error).toBeNull();
  });

  it("加载失败时设置 error（Error 对象）", async () => {
    vi.mocked(assets.listSilhouettes).mockRejectedValueOnce(new Error("500"));

    const { result } = renderHook(() => usePublicAssets());

    await waitFor(() => {
      expect(result.current.error).toBe("500");
    });
    expect(result.current.loading).toBe(false);
  });

  it("加载失败时非 Error 对象使用默认消息", async () => {
    vi.mocked(assets.listMusic).mockRejectedValueOnce("boom");

    const { result } = renderHook(() => usePublicAssets());

    await waitFor(() => {
      expect(result.current.error).toBe("获取公共资源失败");
    });
  });

  it("手动 refresh 重新拉取", async () => {
    const { result } = renderHook(() => usePublicAssets());
    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.mocked(assets.listSilhouettes).mockResolvedValueOnce([
      { name: "villain.svg", path: "silhouettes/villain.svg", size_bytes: 3 },
    ]);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.silhouettes[0].name).toBe("villain.svg");
  });

  it("getAssetUrl 委托给 assets.url", async () => {
    const { result } = renderHook(() => usePublicAssets());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.getAssetUrl("music", "bgm.mp3")).toBe("http://api/music/bgm.mp3");
    expect(result.current.getAssetUrl("silhouettes", "hero.png")).toBe(
      "http://api/silhouettes/hero.png",
    );
  });
});
