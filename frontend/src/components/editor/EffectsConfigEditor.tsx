"use client";

import React from "react";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import type { AnimationConfig, PopupStyle, GlowStyle } from "../../types/radar";

type EffectsConfigEditorProps = {
  pageIndex: number;
  animation: AnimationConfig;
  onChange: (animation: AnimationConfig) => void;
  importMenu?: React.ReactNode;
};

const popupStyles: { value: PopupStyle; label: string }[] = [
  { value: "spring", label: "弹簧" },
  { value: "bounce", label: "弹跳" },
  { value: "fadeScale", label: "淡入缩放" },
  { value: "slideIn", label: "滑入" },
];

const glowStyles: { value: GlowStyle; label: string }[] = [
  { value: "pulse", label: "脉冲" },
  { value: "ring", label: "扩散环" },
  { value: "ripple", label: "涟漪" },
  { value: "sparkle", label: "闪烁" },
];

export const EffectsConfigEditor: React.FC<EffectsConfigEditorProps> = ({
  pageIndex,
  animation,
  onChange,
  importMenu,
}) => {
  const update = <K extends keyof AnimationConfig>(
    key: K,
    value: AnimationConfig[K],
  ) => {
    onChange({ ...animation, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">特效配置</h3>
        {importMenu}
      </div>

      {/* 高数值阈值 */}
      <div
        className="space-y-1"
        data-field-id={`page:${pageIndex}:animation.highValueThreshold`}
      >
        <Label className="text-xs">高属性阈值: {animation.highValueThreshold}</Label>
        <Slider
          value={[animation.highValueThreshold]}
          onValueChange={(v) => update("highValueThreshold", Array.isArray(v) ? v[0] : v)}
          min={50}
          max={200}
          step={1}
        />
      </div>

      {/* 数值弹窗 */}
      <div
        className="space-y-2"
        data-field-id={`page:${pageIndex}:animation.valuePopupEnabled`}
      >
        <div className="flex items-center justify-between">
          <Label className="text-xs">数值弹窗</Label>
          <Switch
            checked={animation.valuePopupEnabled}
            onCheckedChange={(v) => update("valuePopupEnabled", v)}
          />
        </div>
        {animation.valuePopupEnabled && (
          <div
            className="flex gap-1 flex-wrap"
            data-field-id={`page:${pageIndex}:animation.valuePopupStyle`}
          >
            {popupStyles.map((s) => (
              <button
                key={s.value}
                onClick={() => update("valuePopupStyle", s.value)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  animation.valuePopupStyle === s.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-accent"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 高数值光晕 */}
      <div
        className="space-y-2"
        data-field-id={`page:${pageIndex}:animation.highValueGlowEnabled`}
      >
        <div className="flex items-center justify-between">
          <Label className="text-xs">高数值光晕</Label>
          <Switch
            checked={animation.highValueGlowEnabled}
            onCheckedChange={(v) => update("highValueGlowEnabled", v)}
          />
        </div>
        {animation.highValueGlowEnabled && (
          <div
            className="flex gap-1 flex-wrap"
            data-field-id={`page:${pageIndex}:animation.highValueGlowStyle`}
          >
            {glowStyles.map((s) => (
              <button
                key={s.value}
                onClick={() => update("highValueGlowStyle", s.value)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  animation.highValueGlowStyle === s.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-accent"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
