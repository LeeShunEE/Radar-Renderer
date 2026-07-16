"use client";

import React from "react";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { BackgroundMediaEditor } from "./BackgroundMediaEditor";
import type { BackgroundConfig, RadarTheme, RadarVideoProps } from "../../types/radar";

type BackgroundConfigPanelProps = {
  background: BackgroundConfig;
  theme: RadarTheme;
  onChange: (updates: Partial<RadarVideoProps>) => void;
};

export const BackgroundConfigPanel: React.FC<BackgroundConfigPanelProps> = ({
  background,
  theme,
  onChange,
}) => {
  const updateTheme = (patch: Partial<RadarTheme>) =>
    onChange({ theme: { ...theme, ...patch } });

  // shadcn Slider 回调可能是数组或裸数值，统一取标量（与 BackgroundMediaEditor 一致）
  const num = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : v);

  return (
    <div className="space-y-3">
      {/* 媒体配置（类型切换 + 素材/不透明度/模糊/缩放/位置 + 视频专属控件） */}
      <BackgroundMediaEditor
        background={background}
        onChange={(bg) => onChange({ background: bg })}
      />

      {/* 暗角效果（迁自 ThemeEditor，雷达页独有；视频页底衬复用 BackgroundMediaEditor 时无此项） */}
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
                data-testid="vignette-brightness"
                value={[theme.vignetteBrightness]}
                onValueChange={(v) =>
                  updateTheme({
                    vignetteBrightness: num(v),
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
                  updateTheme({ vignetteCenterX: num(v) })
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
                  updateTheme({ vignetteCenterY: num(v) })
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
                    vignetteInnerStop: num(v),
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
                    vignetteOuterStop: num(v),
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
