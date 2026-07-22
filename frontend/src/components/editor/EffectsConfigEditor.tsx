"use client";

import React from "react";
import { useTranslations } from "next-intl";
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

const popupStyles: PopupStyle[] = ["spring", "bounce", "fadeScale", "slideIn"];

const glowStyles: GlowStyle[] = ["pulse", "ring", "ripple", "sparkle"];

export const EffectsConfigEditor: React.FC<EffectsConfigEditorProps> = ({
  pageIndex,
  animation,
  onChange,
  importMenu,
}) => {
  const t = useTranslations("editor.effects");
  const update = <K extends keyof AnimationConfig>(
    key: K,
    value: AnimationConfig[K],
  ) => {
    onChange({ ...animation, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
        {importMenu}
      </div>

      {/* 高数值阈值 */}
      <div
        className="space-y-1"
        data-field-id={`page:${pageIndex}:animation.highValueThreshold`}
      >
        <Label className="text-xs">{t("threshold", { value: animation.highValueThreshold })}</Label>
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
          <Label className="text-xs">{t("valuePopup")}</Label>
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
                key={s}
                onClick={() => update("valuePopupStyle", s)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  animation.valuePopupStyle === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-accent"
                }`}
              >
                {t(`popupStyle.${s}`)}
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
          <Label className="text-xs">{t("glow")}</Label>
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
                key={s}
                onClick={() => update("highValueGlowStyle", s)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  animation.highValueGlowStyle === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-accent"
                }`}
              >
                {t(`glowStyle.${s}`)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
