"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Input } from "../ui/input";
import type { FontConfig } from "../../types/radar";

type FontSizeEditorProps = {
  font: FontConfig;
  onChange: (font: FontConfig) => void;
  importMenu?: React.ReactNode;
};

const fields: {
  key: "characterName" | "attributeLabel" | "ratingLabel" | "valuePopup";
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "characterName", min: 30, max: 180, step: 1 },
  { key: "attributeLabel", min: 18, max: 90, step: 1 },
  { key: "ratingLabel", min: 15, max: 75, step: 1 },
  { key: "valuePopup", min: 18, max: 75, step: 1 },
];

export const FontSizeEditor: React.FC<FontSizeEditorProps> = ({
  font,
  onChange,
  importMenu,
}) => {
  const t = useTranslations("editor");
  const update = (key: "characterName" | "attributeLabel" | "ratingLabel" | "valuePopup", value: number) => {
    onChange({ ...font, [key]: value });
  };

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("fontSize.title")}</h3>
        {importMenu}
      </div>
      {fields.map(({ key, min, max, step }) => (
        <div key={key} className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{t(`fontFields.${key}`)}</Label>
            <Input
              type="number"
              min={min}
              max={max}
              value={font[key]}
              onChange={(e) =>
                update(key, clamp(Number(e.target.value), min, max))
              }
              className="w-16 h-6 text-xs text-center"
            />
          </div>
          <Slider
            value={[font[key]]}
            onValueChange={(v) => update(key, Array.isArray(v) ? v[0] : v)}
            min={min}
            max={max}
            step={step}
          />
        </div>
      ))}
    </div>
  );
};
