"use client";

import React from "react";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { ColorPicker } from "../ui/color-picker";
import { AssetSelector } from "../files/AssetSelector";
import { BackgroundMediaEditor } from "./BackgroundMediaEditor";
import { VIDEO_FPS } from "../../types/constants";
import type { VideoPageConfig } from "../../types/radar";

type VideoPageConfigPanelProps = {
  page: VideoPageConfig;
  onUpdate: (updates: Partial<VideoPageConfig>) => void;
};

const FIT_OPTIONS = ["contain", "cover", "fill"] as const;

/**
 * 探测视频时长并换算为帧数（VIDEO_FPS）。
 * - 正常 mp4/mov：onloadedmetadata 即可读到有限 duration。
 * - 流式 webm：duration 常为 Infinity，需 seek 到末尾触发时长确定（seek 兜底）。
 * - 探测失败（onerror / seek 后仍非有限）返回 null，调用方保留用户手填值。
 */
async function probeDurationInFrames(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) {
        resolve(Math.max(1, Math.round(v.duration * VIDEO_FPS)));
        return;
      }
      // 流式 webm duration=Infinity：seek 到极大时间触发时长确定
      v.ontimeupdate = () => {
        v.ontimeupdate = null;
        if (Number.isFinite(v.duration)) {
          resolve(Math.max(1, Math.round(v.duration * VIDEO_FPS)));
        } else {
          resolve(null);
        }
      };
      v.currentTime = 1e101;
    };
    v.onerror = () => resolve(null);
    v.src = url;
  });
}

export const VideoPageConfigPanel: React.FC<VideoPageConfigPanelProps> = ({
  page,
  onUpdate,
}) => {
  const { label, src, durationInFrames, fit, audio, chromaKey, background } = page;

  const handleSrcChange = (nextSrc: string) => {
    onUpdate({ src: nextSrc });
    if (nextSrc) {
      // 选中素材后自动探测时长回填；失败则保留用户手填值
      void probeDurationInFrames(nextSrc).then((frames) => {
        if (frames !== null) onUpdate({ durationInFrames: frames });
      });
    }
  };

  const num = (v: number[]) => (Array.isArray(v) ? v[0] : v);

  return (
    <div className="space-y-4 border border-unfocused-border-color rounded-lg p-4 bg-card">
      <h3 className="text-sm font-semibold text-foreground">视频页配置</h3>

      {/* 主视频素材 */}
      <div className="space-y-2">
        <Label className="text-xs text-subtitle">视频素材</Label>
        <AssetSelector
          category="backgrounds"
          mediaKind="video"
          value={src}
          onChange={handleSrcChange}
        />
      </div>

      {/* 基础 */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-subtitle">标签</Label>
          <Input
            data-testid="vp-label"
            value={label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="视频页名称"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-subtitle">时长（帧）</Label>
          <Input
            data-testid="vp-duration"
            type="number"
            min={1}
            max={18000}
            value={durationInFrames}
            onChange={(e) =>
              onUpdate({ durationInFrames: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-subtitle">填充模式</Label>
          <div className="flex items-center gap-1">
            {FIT_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                data-testid={`vp-fit-${f}`}
                onClick={() => onUpdate({ fit: f })}
                className={`text-xs px-2 py-0.5 rounded border ${
                  fit === f
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input text-subtitle hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 音频 */}
      <div className="space-y-3 pt-2 border-t border-unfocused-border-color">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-subtitle">静音</Label>
          <Switch
            data-testid="vp-audio-muted"
            checked={audio.muted}
            onCheckedChange={(v) => onUpdate({ audio: { muted: v } })}
          />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-xs text-subtitle">音量</Label>
            <span className="text-xs text-subtitle">
              {Math.round(audio.volume * 100)}%
            </span>
          </div>
          <Slider
            data-testid="vp-volume"
            value={[audio.volume]}
            min={0}
            max={1}
            step={0.05}
            onValueChange={(v) => onUpdate({ audio: { volume: num(v) } })}
          />
        </div>
      </div>

      {/* 色键（绿幕/蓝幕抠像） */}
      <div className="space-y-3 pt-2 border-t border-unfocused-border-color">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-foreground">色键（绿幕/蓝幕抠像）</h4>
          <Switch
            data-testid="vp-chroma-enabled"
            checked={chromaKey.enabled}
            onCheckedChange={(v) => onUpdate({ chromaKey: { enabled: v } })}
          />
        </div>
        {chromaKey.enabled && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-subtitle">关键色</Label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="vp-preset-green"
                  onClick={() => onUpdate({ chromaKey: { keyColor: "#00ff00" } })}
                  className="text-xs px-2 py-0.5 rounded border border-input text-subtitle hover:text-foreground"
                >
                  绿幕
                </button>
                <button
                  type="button"
                  data-testid="vp-preset-blue"
                  onClick={() => onUpdate({ chromaKey: { keyColor: "#0000ff" } })}
                  className="text-xs px-2 py-0.5 rounded border border-input text-subtitle hover:text-foreground"
                >
                  蓝幕
                </button>
                <ColorPicker
                  value={chromaKey.keyColor}
                  onChange={(v) => onUpdate({ chromaKey: { keyColor: v } })}
                />
                <span className="text-xs text-subtitle font-mono truncate">
                  {chromaKey.keyColor}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs text-subtitle">相似度</Label>
                <span className="text-xs text-subtitle">{chromaKey.similarity}</span>
              </div>
              <Slider
                data-testid="vp-similarity"
                value={[chromaKey.similarity]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(v) => onUpdate({ chromaKey: { similarity: num(v) } })}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs text-subtitle">平滑度</Label>
                <span className="text-xs text-subtitle">{chromaKey.smoothness}</span>
              </div>
              <Slider
                data-testid="vp-smoothness"
                value={[chromaKey.smoothness]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(v) => onUpdate({ chromaKey: { smoothness: num(v) } })}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs text-subtitle">溢出抑制</Label>
                <span className="text-xs text-subtitle">{chromaKey.spillSuppression}</span>
              </div>
              <Slider
                data-testid="vp-spill"
                value={[chromaKey.spillSuppression]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(v) =>
                  onUpdate({ chromaKey: { spillSuppression: num(v) } })
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* 底衬背景（抠像后的底层；视频页无暗角） */}
      <div className="space-y-3 pt-2 border-t border-unfocused-border-color">
        <BackgroundMediaEditor
          background={background}
          onChange={(bg) => onUpdate({ background: bg })}
        />
      </div>
    </div>
  );
};
