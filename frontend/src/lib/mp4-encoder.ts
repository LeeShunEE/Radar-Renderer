/**
 * WebCodecs + mp4-muxer 管线：在浏览器端编码 H.264+AAC MP4。
 *
 * 特性探测：isMp4RenderSupported()
 * 编码器工厂：createMp4Encoder({width,height,fps,audioBuffer})
 * 音轨编码：encodeAudioTrack(muxer, audioBuffer, durationSec)
 *
 * 依赖 WebCodecs（VideoEncoder/AudioEncoder）与 mp4-muxer v5。
 * 不支持 WebCodecs 的浏览器应回退到 WebM/MediaRecorder。
 */
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

export interface Mp4EncoderOptions {
  /** 输出视频宽度（像素） */
  width: number;
  /** 输出视频高度（像素） */
  height: number;
  /** 帧率（帧/秒） */
  fps: number;
  /** 音频数据（可选，无音频时仅视频轨） */
  audioBuffer?: AudioBuffer | null;
}

export interface Mp4Encoder {
  /** 添加一帧画面（从 Canvas 截取）。frameIndex 从 0 开始。 */
  addFrame: (canvas: HTMLCanvasElement, frameIndex: number) => Promise<void>;
  /** 完成编码，返回 MP4 Blob。 */
  finalize: () => Promise<Blob>;
}

/**
 * 探测当前浏览器是否支持 WebCodecs MP4 编码。
 *
 * 检查：
 * 1. VideoEncoder / AudioEncoder API 存在
 * 2. H.264 (avc1.640028 / avc1.4D0028) 配置被支持
 * 3. AAC (mp4a.40.2) 配置被支持（如有音频）
 */
export async function isMp4RenderSupported(audioSampleRate?: number, audioChannels?: number): Promise<boolean> {
  // API 存在性
  if (!("VideoEncoder" in window) || !("AudioEncoder" in window)) {
    return false;
  }

  // VideoEncoder 配置探测
  const videoCodecCandidates = ["avc1.640028", "avc1.4D0028"]; // High L4.0, Main L4.0
  let videoSupported = false;
  for (const codec of videoCodecCandidates) {
    const support = await (window.VideoEncoder as typeof VideoEncoder).isConfigSupported({
      codec,
      width: 1920,
      height: 1080,
      framerate: 30,
    });
    if (support.supported) {
      videoSupported = true;
      break;
    }
  }
  if (!videoSupported) return false;

  // AudioEncoder 配置探测（仅当有音频参数时）
  if (audioSampleRate !== undefined && audioChannels !== undefined) {
    const audioSupport = await (window.AudioEncoder as typeof AudioEncoder).isConfigSupported({
      codec: "mp4a.40.2", // AAC-LC
      sampleRate: audioSampleRate,
      numberOfChannels: audioChannels,
    });
    if (!audioSupport.supported) return false;
  }

  return true;
}

/**
 * 创建 MP4 编码器实例。
 *
 * 内部启动 VideoEncoder + AudioEncoder（如有 audioBuffer），
 * 并初始化 mp4-muxer 管线。
 */
export function createMp4Encoder(options: Mp4EncoderOptions): Mp4Encoder {
  const { width, height, fps, audioBuffer } = options;

  // 目标：内存缓冲
  const target = new ArrayBufferTarget();

  // 音频参数（从 AudioBuffer 提取）
  const audioSampleRate = audioBuffer?.sampleRate ?? 0;
  const audioChannels = audioBuffer?.numberOfChannels ?? 0;

  // Muxer 配置
  const muxer = new Muxer({
    target,
    video: {
      codec: "avc",
      width,
      height,
      frameRate: fps,
    },
    audio: audioBuffer
      ? {
          codec: "aac",
          sampleRate: audioSampleRate,
          numberOfChannels: audioChannels,
        }
      : undefined,
    fastStart: "in-memory",
    firstTimestampBehavior: "offset", // 确保从 0 开始
  });

  // 编码产物队列（用于等待 flush）
  let videoChunksPending = 0;
  let audioChunksPending = 0;

  // VideoEncoder
  let videoEncoderClosed = false;
  const videoEncoder = new (window.VideoEncoder as typeof VideoEncoder)({
    output: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => {
      muxer.addVideoChunk(chunk, meta);
      videoChunksPending--;
    },
    error: (e: Error) => {
      console.error("VideoEncoder error:", e);
      videoEncoderClosed = true;
    },
  });

  // 选择 codec（优先 High L4.0）
  const videoCodec = "avc1.640028"; // 实际探测已保证支持
  videoEncoder.configure({
    codec: videoCodec,
    width,
    height,
    framerate: fps,
    bitrate: 8e6, // 8 Mbps
    latencyMode: "quality",
  });

  // AudioEncoder（如有）
  let audioEncoderClosed = false;
  let audioEncoder: AudioEncoder | null = null;
  if (audioBuffer) {
    audioEncoder = new (window.AudioEncoder as typeof AudioEncoder)({
      output: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => {
        muxer.addAudioChunk(chunk, meta);
        audioChunksPending--;
      },
      error: (e: Error) => {
        console.error("AudioEncoder error:", e);
        audioEncoderClosed = true;
      },
    });
    audioEncoder.configure({
      codec: "mp4a.40.2",
      sampleRate: audioSampleRate,
      numberOfChannels: audioChannels,
      bitrate: 128000,
    });
  }

  // ========== 音轨编码 ==========

  // 计算视频时长（秒）—— 用于裁剪音频
  // 注意：durationSec 在 finalize 时由实际帧数决定，这里先预置占位
  let totalFrameCount = 0;
  let audioEncoded = false;

  /**
   * 编码音轨到 muxer（一次性调用）。
   *
   * 从 AudioBuffer 取 PCM 数据，按块封装 AudioData → encode。
   * 裁剪到 videoDuration 秒，不循环。
   */
  async function encodeAudioTrack(videoDurationSec: number): Promise<void> {
    if (!audioBuffer || !audioEncoder || audioEncoded) return;
    audioEncoded = true;

    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    const totalAudioFrames = audioBuffer.length;
    const audioDurationSec = totalAudioFrames / sampleRate;

    // 裁剪时长
    const targetDurationSec = Math.min(audioDurationSec, videoDurationSec);
    const targetFrames = Math.floor(targetDurationSec * sampleRate);

    // 每块帧数（约 4096，保证 timestamp 递增合理）
    const chunkFrames = 4096;
    const frameDurationUs = 1e6 / sampleRate;

    let pos = 0;
    while (pos < targetFrames && !audioEncoderClosed) {
      const chunkLen = Math.min(chunkFrames, targetFrames - pos);
      const timestampUs = Math.round(pos * frameDurationUs);

      // 从 AudioBuffer 提取 PCM（f32-planar 格式）
      // AudioData 需要 interleaved 或 planar + transfer
      // WebCodecs AudioData 支持 f32-planar 格式
      const planarData: Float32Array[] = [];
      for (let ch = 0; ch < channels; ch++) {
        const chData = audioBuffer.getChannelData(ch).slice(pos, pos + chunkLen);
        planarData.push(chData);
      }

      // 合并为一个 ArrayBuffer（planar layout）
      const totalSamples = chunkLen * channels;
      const buffer = new Float32Array(totalSamples);
      for (let ch = 0; ch < channels; ch++) {
        buffer.set(planarData[ch], ch * chunkLen);
      }

      const audioData = new (window.AudioData as typeof AudioData)({
        data: buffer.buffer as ArrayBuffer,
        format: "f32-planar",
        numberOfFrames: chunkLen,
        numberOfChannels: channels,
        sampleRate,
        timestamp: timestampUs,
        transfer: [buffer.buffer as ArrayBuffer],
      });

      audioChunksPending++;
      audioEncoder.encode(audioData);
      audioData.close();

      pos += chunkLen;

      // 背压：队列过长时等待
      while (audioChunksPending > 16) {
        await new Promise((r) => setTimeout(r, 10));
      }
    }
  }

  // ========== 视帧编码 ==========

  /**
   * 添加一帧画面。
   *
   * 从 Canvas 创建 VideoFrame → encode → close。
   * 处理 encodeQueueSize 背压。
   */
  async function addFrame(canvas: HTMLCanvasElement, frameIndex: number): Promise<void> {
    if (videoEncoderClosed) throw new Error("VideoEncoder is closed");

    const timestampUs = Math.round(frameIndex * (1e6 / fps));
    const durationUs = Math.round(1e6 / fps);

    const videoFrame = new (window.VideoFrame as typeof VideoFrame)(canvas, {
      timestamp: timestampUs,
      duration: durationUs,
      displayWidth: width,
      displayHeight: height,
    });

    // 关键帧：每秒至少一个（fps 帧）
    const keyFrame = frameIndex % fps === 0;

    videoChunksPending++;
    videoEncoder.encode(videoFrame, { keyFrame });
    videoFrame.close();

    totalFrameCount = frameIndex + 1;

    // 背压：队列过长时等待
    while (videoEncoder.encodeQueueSize > 8) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  /**
   * 完成编码并返回 MP4 Blob。
   *
   * 流程：
   * 1. 编码音轨（如有 audioBuffer）
   * 2. flush VideoEncoder + AudioEncoder
   * 3. 等待所有 pending chunks 写入
   * 4. muxer.finalize()
   * 5. 从 target.buffer 创建 Blob
   */
  async function finalize(): Promise<Blob> {
    if (videoEncoderClosed) throw new Error("VideoEncoder is closed");

    // 计算视频时长
    const videoDurationSec = totalFrameCount / fps;

    // 编码音轨
    await encodeAudioTrack(videoDurationSec);

    // Flush encoders
    await videoEncoder.flush();
    if (audioEncoder && !audioEncoderClosed) {
      await audioEncoder.flush();
    }

    // 等待所有 chunks 写入 muxer
    while (videoChunksPending > 0 || audioChunksPending > 0) {
      await new Promise((r) => setTimeout(r, 10));
    }

    // 关闭编码器
    videoEncoder.close();
    if (audioEncoder) audioEncoder.close();

    // 完成封装
    muxer.finalize();

    // 创建 Blob
    const blob = new Blob([target.buffer], { type: "video/mp4" });
    return blob;
  }

  return { addFrame, finalize };
}