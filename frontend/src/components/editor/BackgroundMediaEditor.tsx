"use client";

import React from "react";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { AssetSelector } from "../files/AssetSelector";
import { mediaKindFromSrc } from "../../lib/media-guard";
import {
  BackgroundMediaSchema,
  type BackgroundConfig,
  type BackgroundMediaConfig,
} from "../../types/radar";

/**
 * 背景媒体编辑器：类型切换（渐变/图片/视频）+ 媒体控件（素材/不透明度/模糊/缩放/位置）
 * + 视频专属控件（循环/速率/起始/声音）。
 *
 * 从 BackgroundConfigPanel 抽出，供雷达页（BackgroundConfigPanel，含暗角）与
 * 视频页（VideoPageConfigPanel，配底衬、无暗角）复用。对外只产出 background 整体，
 * 调用方决定如何并入各自配置（雷达页并入 RadarVideoProps.background，视频页同理）。
 */
type BackgroundMediaEditorProps = {
  background: BackgroundConfig;
  onChange: (background: BackgroundConfig) => void;
};

const SCALE_OPTIONS: BackgroundMediaConfig["scale"][] = ["cover", "contain", "fill"];
const POSITION_OPTIONS: BackgroundMediaConfig["position"][] = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
];

export const BackgroundMediaEditor: React.FC<BackgroundMediaEditorProps> = ({
  background,
  onChange,
}) => {
  // ── helpers ──────────────────────────────────────────────────────────────
  const media = background.media ?? BackgroundMediaSchema.parse({ src: "" });

  const updateMedia = (patch: Partial<BackgroundMediaConfig>) =>
    onChange({ ...background, media: { ...media, ...patch } });

  const updateVideoOptions = (
    patch: Partial<BackgroundMediaConfig["videoOptions"]>,
  ) =>
    onChange({
      ...background,
      media: { ...media, videoOptions: { ...media.videoOptions, ...patch } },
    });

  // shadcn Slider 回调可能是数组或裸数值（测试 mock 与真实组件行为不同），统一取标量
  const num = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : v);

  // ── type switch ───────────────────────────────────────────────────────────
  const handleTypeChange = (type: BackgroundConfig["type"]) => {
    if (type === "gradient") {
      // 切回渐变时保留 media，便于来回切换不丢失已选素材（往返非破坏性）。
      // 渲染端按 type==="gradient" 分发，保留的 media 不影响渐变渲染（见 selectBackgroundKind）。
      onChange({ type: "gradient", media: background.media });
    } else {
      const nextMedia = background.media ?? BackgroundMediaSchema.parse({ src: "" });
      // 类型不匹配的旧 src 必须清掉：图片进 <Video> / 视频进 <Img> 会直接报错。
      // 无法识别类型的 src（如 blob:）保留，交给用户判断。
      const srcKind = mediaKindFromSrc(nextMedia.src);
      const src = srcKind !== null && srcKind !== type ? "" : nextMedia.src;
      onChange({ type, media: { ...nextMedia, src } });
    }
  };

  const isMedia = background.type !== "gradient";
  const isVideo = background.type === "video";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">背景配置</h3>
      </div>

      {/* 类型切换 */}
      <div className="flex items-center gap-1">
        {(["gradient", "image", "video"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTypeChange(t)}
            className={`text-xs px-2 py-0.5 rounded border ${
              background.type === t
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input text-subtitle hover:text-foreground"
            }`}
          >
            {t === "gradient" ? "渐变" : t === "image" ? "图片" : "视频"}
          </button>
        ))}
      </div>

      {/* 媒体控件（type=image 或 video） */}
      {isMedia && (
        <div className="space-y-3">
          <AssetSelector
            category="backgrounds"
            mediaKind={isVideo ? "video" : "image"}
            value={media.src}
            onChange={(src) => updateMedia({ src })}
          />

          {/* 不透明度 */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">不透明度</Label>
              <span className="text-xs text-subtitle">
                {Math.round(media.opacity * 100)}%
              </span>
            </div>
            <Slider
              value={[media.opacity]}
              onValueChange={(v) =>
                updateMedia({ opacity: num(v) })
              }
              min={0}
              max={1}
              step={0.05}
            />
          </div>

          {/* 模糊 */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">模糊</Label>
              <span className="text-xs text-subtitle">{media.blur}px</span>
            </div>
            <Slider
              value={[media.blur]}
              onValueChange={(v) =>
                updateMedia({ blur: num(v) })
              }
              min={0}
              max={50}
              step={1}
            />
          </div>

          {/* 缩放模式 */}
          <div className="space-y-1">
            <Label className="text-xs">缩放</Label>
            <div className="flex items-center gap-1">
              {SCALE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateMedia({ scale: s })}
                  className={`text-xs px-2 py-0.5 rounded border ${
                    media.scale === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input text-subtitle hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 位置 */}
          <div className="space-y-1">
            <Label className="text-xs">位置</Label>
            <div className="flex items-center gap-1 flex-wrap">
              {POSITION_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updateMedia({ position: p })}
                  className={`text-xs px-2 py-0.5 rounded border ${
                    media.position === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input text-subtitle hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* 视频专属控件 */}
          {isVideo && (
            <div className="space-y-3 pt-2 border-t border-unfocused-border-color">
              {/* 循环 */}
              <div className="flex items-center justify-between">
                <Label className="text-xs">循环</Label>
                <Switch
                  checked={media.videoOptions.loop}
                  onCheckedChange={(v) => updateVideoOptions({ loop: v })}
                />
              </div>

              {/* 播放速率 */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-xs">播放速率</Label>
                  <span className="text-xs text-subtitle">
                    {media.videoOptions.playbackRate}x
                  </span>
                </div>
                <Slider
                  value={[media.videoOptions.playbackRate]}
                  onValueChange={(v) =>
                    updateVideoOptions({
                      playbackRate: num(v),
                    })
                  }
                  min={0.25}
                  max={4}
                  step={0.25}
                />
              </div>

              {/* 起始位置 */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-xs">起始位置 (ms)</Label>
                  <span className="text-xs text-subtitle">
                    {media.videoOptions.startFrom}ms
                  </span>
                </div>
                <Slider
                  value={[media.videoOptions.startFrom]}
                  onValueChange={(v) =>
                    updateVideoOptions({
                      startFrom: num(v),
                    })
                  }
                  min={0}
                  max={30000}
                  step={100}
                />
              </div>

              {/* 声音（默认静音，开启后仅服务端渲染有效） */}
              <div className="flex items-center justify-between">
                <Label className="text-xs">声音</Label>
                <Switch
                  data-testid="video-muted-switch"
                  checked={!media.videoOptions.muted}
                  onCheckedChange={(v) => updateVideoOptions({ muted: !v })}
                />
              </div>
              {!media.videoOptions.muted && (
                <p
                  data-testid="client-export-audio-notice"
                  className="text-xs rounded border border-yellow-400/50 bg-yellow-50/10 px-2 py-1.5 text-yellow-600 dark:text-yellow-400 leading-relaxed"
                >
                  ⚠ 背景视频声音仅在<strong>服务端渲染成片</strong>中生效；浏览器即时导出不含背景视频声音（音乐轨道不受影响）。
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
