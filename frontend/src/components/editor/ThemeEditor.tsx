"use client";

import React from "react";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { ColorPicker } from "../ui/color-picker";
import type { RadarTheme } from "../../types/radar";

type ThemeEditorProps = {
  theme: RadarTheme;
  onChange: (theme: RadarTheme) => void;
  importMenu?: React.ReactNode;
};

const colorFields: { key: keyof RadarTheme; label: string }[] = [
  { key: "backgroundColor", label: "背景色" },
  { key: "gridColor", label: "网格色" },
  { key: "gridFillColor", label: "填充色" },
  { key: "gridStrokeColor", label: "描边色" },
  { key: "dotColor", label: "圆点色" },
  { key: "highValueDotColor", label: "高属性圆点色" },
  { key: "labelColor", label: "标签色" },
  { key: "valueColor", label: "数值色" },
  { key: "glowColor", label: "发光色" },
  { key: "enhanceArrowColor", label: "增强箭头色" },
  { key: "weakenArrowColor", label: "变弱箭头色" },
];

export const ThemeEditor: React.FC<ThemeEditorProps> = ({
  theme,
  onChange,
  importMenu,
}) => {
  const updateColor = (key: keyof RadarTheme, value: string) => {
    onChange({ ...theme, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">主题配色</h3>
        {importMenu}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {colorFields.map(({ key, label }) => {
          const color = theme[key] as string;
          return (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <div className="flex items-center gap-2">
                <ColorPicker
                  value={color}
                  onChange={(v) => updateColor(key, v)}
                />
                <span className="text-xs text-subtitle font-mono truncate flex-1">
                  {color}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3 pt-2 border-t border-unfocused-border-color">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">暗角效果</h3>
          <Switch
            checked={theme.vignetteEnabled}
            onCheckedChange={(v) => onChange({ ...theme, vignetteEnabled: v })}
          />
        </div>

        {theme.vignetteEnabled && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="col-span-2 space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs">亮度偏移</Label>
                <span className="text-xs text-subtitle">{theme.vignetteBrightness}</span>
              </div>
              <Slider
                value={[theme.vignetteBrightness]}
                onValueChange={(v) => onChange({ ...theme, vignetteBrightness: (Array.isArray(v) ? v[0] : v) })}
                min={-100}
                max={0}
                step={1}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs">中心 X</Label>
                <span className="text-xs text-subtitle">{theme.vignetteCenterX}%</span>
              </div>
              <Slider
                value={[theme.vignetteCenterX]}
                onValueChange={(v) => onChange({ ...theme, vignetteCenterX: (Array.isArray(v) ? v[0] : v) })}
                min={0}
                max={100}
                step={1}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs">中心 Y</Label>
                <span className="text-xs text-subtitle">{theme.vignetteCenterY}%</span>
              </div>
              <Slider
                value={[theme.vignetteCenterY]}
                onValueChange={(v) => onChange({ ...theme, vignetteCenterY: (Array.isArray(v) ? v[0] : v) })}
                min={0}
                max={100}
                step={1}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs">内圈位置</Label>
                <span className="text-xs text-subtitle">{theme.vignetteInnerStop}%</span>
              </div>
              <Slider
                value={[theme.vignetteInnerStop]}
                onValueChange={(v) => onChange({ ...theme, vignetteInnerStop: (Array.isArray(v) ? v[0] : v) })}
                min={0}
                max={90}
                step={1}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs">外圈位置</Label>
                <span className="text-xs text-subtitle">{theme.vignetteOuterStop}%</span>
              </div>
              <Slider
                value={[theme.vignetteOuterStop]}
                onValueChange={(v) => onChange({ ...theme, vignetteOuterStop: (Array.isArray(v) ? v[0] : v) })}
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
