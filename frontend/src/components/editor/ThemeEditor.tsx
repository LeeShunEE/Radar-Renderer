"use client";

import React from "react";
import { Label } from "../ui/label";
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
    </div>
  );
};
