"use client";

import React from "react";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { AssetSelector } from "../files/AssetSelector";
import {
  BackgroundMediaSchema,
  type BackgroundConfig,
  type BackgroundMediaConfig,
  type RadarTheme,
  type RadarVideoProps,
} from "../../types/radar";

type BackgroundConfigPanelProps = {
  background: BackgroundConfig;
  theme: RadarTheme;
  onChange: (updates: Partial<RadarVideoProps>) => void;
  importMenu?: React.ReactNode;
};

const SCALE_OPTIONS: BackgroundMediaConfig["scale"][] = ["cover", "contain", "fill"];
const POSITION_OPTIONS: BackgroundMediaConfig["position"][] = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
];

export const BackgroundConfigPanel: React.FC<BackgroundConfigPanelProps> = ({
  background,
  theme,
  onChange,
}) => {
  // ── helpers ──────────────────────────────────────────────────────────────
  const media = background.media ?? BackgroundMediaSchema.parse({ src: "" });

  const updateMedia = (patch: Partial<BackgroundMediaConfig>) =>
    onChange({
      background: { ...background, media: { ...media, ...patch } },
    });

  const updateVideoOptions = (
    patch: Partial<BackgroundMediaConfig["videoOptions"]>,
  ) =>
    onChange({
      background: {
        ...background,
        media: { ...media, videoOptions: { ...media.videoOptions, ...patch } },
      },
    });

  const updateTheme = (patch: Partial<RadarTheme>) =>
    onChange({ theme: { ...theme, ...patch } });

  // ── type switch ───────────────────────────────────────────────────────────
  const handleTypeChange = (type: BackgroundConfig["type"]) => {
    if (type === "gradient") {
      onChange({ background: { type: "gradient", media: background.media } });
    } else {
      onChange({
        background: {
          type,
          media: background.media ?? BackgroundMediaSchema.parse({ src: "" }),
        },
      });
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
                updateMedia({ opacity: Array.isArray(v) ? v[0] : v })
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
                updateMedia({ blur: Array.isArray(v) ? v[0] : v })
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
                      playbackRate: Array.isArray(v) ? v[0] : v,
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
                      startFrom: Array.isArray(v) ? v[0] : v,
                    })
                  }
                  min={0}
                  max={30000}
                  step={100}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 暗角效果（迁自 ThemeEditor） */}
      <div className="space-y-3 pt-2 border-t border-unfocused-border-color">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">暗角效果</h3>
          <Switch
            checked={theme.vignetteEnabled}
            onCheckedChange={(v) => updateTheme({ vignetteEnabled: v })}
          />
        </div>

        {theme.vignetteEnabled && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="col-span-2 space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs">亮度偏移</Label>
                <span className="text-xs text-subtitle">
                  {theme.vignetteBrightness}
                </span>
              </div>
              <Slider
                value={[theme.vignetteBrightness]}
                onValueChange={(v) =>
                  updateTheme({
                    vignetteBrightness: Array.isArray(v) ? v[0] : v,
                  })
                }
                min={-100}
                max={0}
                step={1}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs">中心 X</Label>
                <span className="text-xs text-subtitle">
                  {theme.vignetteCenterX}%
                </span>
              </div>
              <Slider
                value={[theme.vignetteCenterX]}
                onValueChange={(v) =>
                  updateTheme({ vignetteCenterX: Array.isArray(v) ? v[0] : v })
                }
                min={0}
                max={100}
                step={1}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs">中心 Y</Label>
                <span className="text-xs text-subtitle">
                  {theme.vignetteCenterY}%
                </span>
              </div>
              <Slider
                value={[theme.vignetteCenterY]}
                onValueChange={(v) =>
                  updateTheme({ vignetteCenterY: Array.isArray(v) ? v[0] : v })
                }
                min={0}
                max={100}
                step={1}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs">内圈位置</Label>
                <span className="text-xs text-subtitle">
                  {theme.vignetteInnerStop}%
                </span>
              </div>
              <Slider
                value={[theme.vignetteInnerStop]}
                onValueChange={(v) =>
                  updateTheme({
                    vignetteInnerStop: Array.isArray(v) ? v[0] : v,
                  })
                }
                min={0}
                max={90}
                step={1}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs">外圈位置</Label>
                <span className="text-xs text-subtitle">
                  {theme.vignetteOuterStop}%
                </span>
              </div>
              <Slider
                value={[theme.vignetteOuterStop]}
                onValueChange={(v) =>
                  updateTheme({
                    vignetteOuterStop: Array.isArray(v) ? v[0] : v,
                  })
                }
                min={10}
                max={100}
                step={1}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
