"use client";

import React from "react";
import { useTranslations } from "next-intl";
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

// label 文案下沉到 messages（editor.animation.fields.<key>）；unitFrame 标记是否附加「帧」单位。
const fields: {
  key: NumberKey;
  min: number;
  max: number;
  step: number;
  unitFrame: boolean;
}[] = [
  { key: "fillDuration", min: 10, max: 120, step: 1, unitFrame: true },
  { key: "silhouetteDelay", min: 0, max: 60, step: 1, unitFrame: true },
  { key: "silhouetteFadeInDuration", min: 5, max: 90, step: 1, unitFrame: true },
  { key: "labelStagger", min: 0, max: 15, step: 1, unitFrame: true },
  { key: "highValueSpringDamping", min: 2, max: 30, step: 1, unitFrame: false },
  { key: "holdDuration", min: 0, max: 600, step: 1, unitFrame: true },
  { key: "nameFadeInDuration", min: 5, max: 60, step: 1, unitFrame: true },
  { key: "nameAppearRatio", min: 0, max: 1, step: 0.05, unitFrame: false },
];

const offsetFields: {
  key: NumberKey;
  min: number;
  max: number;
}[] = [
  { key: "labelStartOffset", min: -60, max: 60 },
  { key: "fillStartOffset", min: -60, max: 60 },
  { key: "effectsStartOffset", min: -120, max: 60 },
  { key: "holdStartOffset", min: -60, max: 60 },
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
  const t = useTranslations("editor.animation");
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
        title={ignored ? t("ignoreTipOff") : t("ignoreTipOn")}
        className={`text-[10px] px-1.5 py-0.5 rounded border ${
          ignored
            ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
            : "border-unfocused-border-color text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        {ignored ? t("ignoredGlobal") : t("ignoreGlobal")}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
        {importMenu}
      </div>
      {fields.map(({ key, min, max, step, unitFrame }) => (
        <div
          key={key}
          className="space-y-1"
          data-field-id={`page:${pageIndex}:animation.${key}`}
        >
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">
              {t(`fields.${key}`)}: {animation[key]}
              {unitFrame ? t("unitFrame") : ""}
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
        <h4 className="text-xs font-medium text-muted-foreground mb-2">{t("stageOffsetHeading")}</h4>
        {offsetFields.map(({ key, min, max }) => (
          <div
            key={key}
            className="space-y-1 mb-2"
            data-field-id={`page:${pageIndex}:animation.${key}`}
          >
            <Label className="text-xs">
              {t(`fields.${key}`)}: {animation[key] > 0 ? `+${animation[key]}` : animation[key]}{t("unitFrame")}
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
