/**
 * mp4-encoder 单元测试：isMp4RenderSupported 特性探测。
 *
 * 编码主体依赖 WebCodecs 运行时（已 coverage 排除），仅测探测函数。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isMp4RenderSupported } from "@/lib/mp4-encoder";

describe("isMp4RenderSupported", () => {
  // 创建 mock VideoEncoder 类
  const createMockVideoEncoder = (supported: boolean | ((...args: unknown[]) => unknown)) => {
    return class VideoEncoder {
      static isConfigSupported = typeof supported === "boolean"
        ? vi.fn().mockResolvedValue({ supported })
        : supported;
      constructor() {}
      configure() {}
      encode() {}
      flush() {}
      close() {}
    };
  };

  const createMockAudioEncoder = (supported: boolean | ((...args: unknown[]) => unknown)) => {
    return class AudioEncoder {
      static isConfigSupported = typeof supported === "boolean"
        ? vi.fn().mockResolvedValue({ supported })
        : supported;
      constructor() {}
      configure() {}
      encode() {}
      flush() {}
      close() {}
    };
  };

  beforeEach(() => {
    // 默认：API 存在 + 配置支持
    (window as unknown as { VideoEncoder: unknown }).VideoEncoder = createMockVideoEncoder(true);
    (window as unknown as { AudioEncoder: unknown }).AudioEncoder = createMockAudioEncoder(true);
  });

  afterEach(() => {
    delete (window as unknown as { VideoEncoder?: unknown }).VideoEncoder;
    delete (window as unknown as { AudioEncoder?: unknown }).AudioEncoder;
  });

  it("VideoEncoder 不存在 → false", async () => {
    delete (window as unknown as { VideoEncoder?: unknown }).VideoEncoder;
    const result = await isMp4RenderSupported();
    expect(result).toBe(false);
  });

  it("AudioEncoder 不存在 → false", async () => {
    delete (window as unknown as { AudioEncoder?: unknown }).AudioEncoder;
    const result = await isMp4RenderSupported();
    expect(result).toBe(false);
  });

  it("H.264 配置不支持 → false", async () => {
    (window as unknown as { VideoEncoder: unknown }).VideoEncoder = createMockVideoEncoder(false);
    const result = await isMp4RenderSupported();
    expect(result).toBe(false);
  });

  it("H.264 High L4.0 支持 → 尝试首选 codec", async () => {
    const mockSupported = vi.fn()
      .mockResolvedValueOnce({ supported: true })
      .mockResolvedValueOnce({ supported: false });
    (window as unknown as { VideoEncoder: unknown }).VideoEncoder = createMockVideoEncoder(mockSupported);
    const result = await isMp4RenderSupported();
    expect(result).toBe(true);
    expect(mockSupported).toHaveBeenCalledWith(expect.objectContaining({ codec: "avc1.640028" }));
  });

  it("H.264 High 不支持但 Main 支持 → 回退成功", async () => {
    const mockSupported = vi.fn()
      .mockResolvedValueOnce({ supported: false })
      .mockResolvedValueOnce({ supported: true });
    (window as unknown as { VideoEncoder: unknown }).VideoEncoder = createMockVideoEncoder(mockSupported);
    const result = await isMp4RenderSupported();
    expect(result).toBe(true);
    expect(mockSupported).toHaveBeenCalledTimes(2);
  });

  it("有音频参数时检测 AudioEncoder 配置", async () => {
    const audioSpy = vi.fn().mockResolvedValue({ supported: true });
    (window as unknown as { AudioEncoder: unknown }).AudioEncoder = createMockAudioEncoder(audioSpy);
    const result = await isMp4RenderSupported(44100, 2);
    expect(result).toBe(true);
    expect(audioSpy).toHaveBeenCalledWith(expect.objectContaining({
      codec: "mp4a.40.2",
      sampleRate: 44100,
      numberOfChannels: 2,
    }));
  });

  it("有音频参数但 AAC 不支持 → false", async () => {
    (window as unknown as { AudioEncoder: unknown }).AudioEncoder = createMockAudioEncoder(false);
    const result = await isMp4RenderSupported(44100, 2);
    expect(result).toBe(false);
  });

  it("无音频参数时不检测 AudioEncoder", async () => {
    const audioSpy = vi.fn().mockResolvedValue({ supported: true });
    (window as unknown as { AudioEncoder: unknown }).AudioEncoder = createMockAudioEncoder(audioSpy);
    const result = await isMp4RenderSupported();
    expect(result).toBe(true);
    expect(audioSpy).not.toHaveBeenCalled();
  });
});