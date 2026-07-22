"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import type { LayoutConfig } from "../../types/radar";

type LayoutEditorProps = {
  layout: LayoutConfig;
  onChange: (layout: LayoutConfig) => void;
  disabled?: boolean;
  importMenu?: React.ReactNode;
};

export const LayoutEditor: React.FC<LayoutEditorProps> = ({
  layout,
  onChange,
  disabled,
  importMenu,
}) => {
  const t = useTranslations("editor.layout");
  const update = <K extends keyof LayoutConfig>(
    key: K,
    value: LayoutConfig[K],
  ) => {
    onChange({ ...layout, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
        {importMenu}
      </div>
      <div
        title={disabled ? t("disabledTip") : undefined}
        className={disabled ? "opacity-40 pointer-events-none" : ""}
      >
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t("radarX", { value: layout.radarCX })}</Label>
          <Slider
            value={[layout.radarCX]}
            onValueChange={(v) => update("radarCX", Array.isArray(v) ? v[0] : v)}
            min={200}
            max={1800}
            step={1}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("radarY", { value: layout.radarCY })}</Label>
          <Slider
            value={[layout.radarCY]}
            onValueChange={(v) => update("radarCY", Array.isArray(v) ? v[0] : v)}
            min={100}
            max={900}
            step={1}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("gridRings", { value: layout.gridRingCount })}</Label>
          <Slider
            value={[layout.gridRingCount]}
            onValueChange={(v) => update("gridRingCount", Array.isArray(v) ? v[0] : v)}
            min={1}
            max={10}
            step={1}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            {t("gridStroke", { value: layout.gridStrokeWidth.toFixed(1) })}
          </Label>
          <Slider
            value={[layout.gridStrokeWidth]}
            onValueChange={(v) =>
              update("gridStrokeWidth", Array.isArray(v) ? v[0] : v)
            }
            min={0.2}
            max={8}
            step={0.1}
          />
        </div>
      </div>
      </div>
    </div>
  );
};
