"use client";

import React from "react";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import type { AnimationConfig as AnimationConfigType } from "../../types/radar";

type NumberKey =
  | "fillDuration"
  | "silhouetteDelay"
  | "silhouetteFadeInDuration"
  | "labelStagger"
  | "highValueSpringDamping"
  | "holdDuration"
  | "nameFadeInDuration"
  | "nameAppearRatio"
  | "labelStartOffset"
  | "fillStartOffset"
  | "effectsStartOffset"
  | "holdStartOffset";

type AnimationConfigEditorProps = {
  pageIndex: number;
  animation: AnimationConfigType;
  onChange: (animation: AnimationConfigType) => void;
  importMenu?: React.ReactNode;
  overrideIgnored?: Record<string, boolean>;
  globalOverrideEnabled?: Record<string, boolean>;
  onToggleIgnoreOverride?: (path: string, ignored: boolean) => void;
};

const fields: {
  key: NumberKey;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}[] = [
  { key: "fillDuration", label: "填充时长", min: 10, max: 120, step: 1, unit: "帧" },
  { key: "silhouetteDelay", label: "剪影延迟", min: 0, max: 60, step: 1, unit: "帧" },
  { key: "silhouetteFadeInDuration", label: "剪影淡入时长", min: 5, max: 90, step: 1, unit: "帧" },
  { key: "labelStagger", label: "标签交错", min: 0, max: 15, step: 1, unit: "帧" },
  { key: "highValueSpringDamping", label: "弹簧阻尼", min: 2, max: 30, step: 1, unit: "" },
  { key: "holdDuration", label: "保持时长", min: 0, max: 600, step: 1, unit: "帧" },
  { key: "nameFadeInDuration", label: "名称淡入时长", min: 5, max: 60, step: 1, unit: "帧" },
  { key: "nameAppearRatio", label: "名称出现占比", min: 0, max: 1, step: 0.05, unit: "" },
];

const offsetFields: {
  key: NumberKey;
  label: string;
  min: number;
  max: number;
}[] = [
  { key: "labelStartOffset", label: "标签开始偏移", min: -60, max: 60 },
  { key: "fillStartOffset", label: "填充开始偏移", min: -60, max: 60 },
  { key: "effectsStartOffset", label: "特效开始偏移", min: -120, max: 60 },
  { key: "holdStartOffset", label: "保持开始偏移", min: -60, max: 60 },
];

export const AnimationConfigEditor: React.FC<AnimationConfigEditorProps> = ({
  pageIndex,
  animation,
  onChange,
  importMenu,
  overrideIgnored,
  globalOverrideEnabled,
  onToggleIgnoreOverride,
}) => {
  const update = (key: NumberKey, value: number) => {
    onChange({ ...animation, [key]: value });
  };

  const renderIgnoreToggle = (key: NumberKey) => {
    if (!onToggleIgnoreOverride) return null;
    const path = `animation.${key}`;
    const overrideOn = !!globalOverrideEnabled?.[path];
    if (!overrideOn) return null;
    const ignored = !!overrideIgnored?.[path];
    return (
      <button
        type="button"
        onClick={() => onToggleIgnoreOverride(path, !ignored)}
        title={ignored ? "本页已忽略全局覆盖" : "点击让本页忽略全局覆盖"}
        className={`text-[10px] px-1.5 py-0.5 rounded border ${
          ignored
            ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
            : "border-unfocused-border-color text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        {ignored ? "已无视全局" : "无视全局"}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">动画配置</h3>
        {importMenu}
      </div>
      {fields.map(({ key, label, min, max, step, unit }) => (
        <div
          key={key}
          className="space-y-1"
          data-field-id={`page:${pageIndex}:animation.${key}`}
        >
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">
              {label}: {animation[key]}
              {unit}
            </Label>
            {renderIgnoreToggle(key)}
          </div>
          <Slider
            value={[animation[key]]}
            onValueChange={(v) => update(key, Array.isArray(v) ? v[0] : v)}
            min={min}
            max={max}
            step={step}
          />
        </div>
      ))}
      <div className="pt-2 mt-2 border-t border-unfocused-border-color/40">
        <h4 className="text-xs font-medium text-muted-foreground mb-2">阶段时序偏移（负值=提前重叠）</h4>
        {offsetFields.map(({ key, label, min, max }) => (
          <div
            key={key}
            className="space-y-1 mb-2"
            data-field-id={`page:${pageIndex}:animation.${key}`}
          >
            <Label className="text-xs">
              {label}: {animation[key] > 0 ? `+${animation[key]}` : animation[key]}帧
            </Label>
            <Slider
              value={[animation[key]]}
              onValueChange={(v) => update(key, Array.isArray(v) ? v[0] : v)}
              min={min}
              max={max}
              step={1}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
