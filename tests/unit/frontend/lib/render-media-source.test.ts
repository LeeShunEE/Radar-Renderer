/**
 * render-media-source 单元测试：resolveMusicUrl 各分支 + fetchAndDecodeAudio Mock。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveMusicUrl, fetchAndDecodeAudio } from "@/lib/render-media-source";

describe("resolveMusicUrl", () => {
  it("空/null/undefined → null", () => {
    expect(resolveMusicUrl(null)).toBeNull();
    expect(resolveMusicUrl(undefined)).toBeNull();
    expect(resolveMusicUrl("")).toBeNull();
  });

  it("http/https 远程 URL → 原样", () => {
    expect(resolveMusicUrl("http://example.com/bgm.mp3")).toBe("http://example.com/bgm.mp3");
    expect(resolveMusicUrl("https://example.com/bgm.mp3")).toBe("https://example.com/bgm.mp3");
  });

  it("前导 / 绝对路径 → 原样", () => {
    expect(resolveMusicUrl("/api/v1/assets/music/bgm.mp3")).toBe("/api/v1/assets/music/bgm.mp3");
  });

  it("相对路径 → 前置 /", () => {
    expect(resolveMusicUrl("music/bgm.mp3")).toBe("/music/bgm.mp3");
    expect(resolveMusicUrl("assets/audio.mp3")).toBe("/assets/audio.mp3");
  });
});

describe("fetchAndDecodeAudio", () => {
  // Mock AudioContext as class constructor
  class MockAudioContext {
    decodeAudioData = vi.fn().mockResolvedValue({
      duration: 10,
      sampleRate: 44100,
      numberOfChannels: 2,
      length: 441000,
      getChannelData: vi.fn(() => new Float32Array(100)),
    });
    close = vi.fn().mockResolvedValue(undefined);
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("AudioContext", MockAudioContext);
    // 清除 window 上的缓存（如有）
    delete (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("null URL → null", async () => {
    const result = await fetchAndDecodeAudio(null);
    expect(result).toBeNull();
  });

  it("fetch 成功 + decodeAudioData 成功 → AudioBuffer", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchAndDecodeAudio("/music/bgm.mp3");
    expect(result).not.toBeNull();
    expect(result?.duration).toBe(10);
    expect(result?.sampleRate).toBe(44100);
  });

  it("fetch 失败 → null（warn 日志）", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal("fetch", mockFetch);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await fetchAndDecodeAudio("/music/missing.mp3");
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("fetch"));

    warnSpy.mockRestore();
  });

  it("decodeAudioData 失败 → null（warn 日志）", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    });
    vi.stubGlobal("fetch", mockFetch);

    // 创建失败版本的 AudioContext
    class FailAudioContext {
      decodeAudioData = vi.fn().mockRejectedValue(new Error("decode failed"));
      close = vi.fn().mockResolvedValue(undefined);
    }
    vi.stubGlobal("AudioContext", FailAudioContext);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await fetchAndDecodeAudio("/music/bgm.mp3");
    expect(result).toBeNull();
    // warnSpy 被调用时传入 message + error object
    expect(warnSpy).toHaveBeenCalled();
    const callArg = warnSpy.mock.calls[0]?.[0];
    expect(callArg).toContain("decodeAudioData");

    warnSpy.mockRestore();
  });

  it("webkitAudioContext 兜底", async () => {
    // 移除 AudioContext，只保留 webkitAudioContext
    vi.stubGlobal("AudioContext", undefined);

    class MockWebKitAudioContext {
      decodeAudioData = vi.fn().mockResolvedValue({
        duration: 5,
        sampleRate: 48000,
        numberOfChannels: 1,
        length: 240000,
        getChannelData: vi.fn(() => new Float32Array(100)),
      });
      close = vi.fn().mockResolvedValue(undefined);
    }
    vi.stubGlobal("webkitAudioContext", MockWebKitAudioContext);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchAndDecodeAudio("/music/bgm.mp3");
    expect(result).not.toBeNull();
    expect(result?.sampleRate).toBe(48000);
  });
});