"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Input } from "../ui/input";
import { Slider } from "../ui/slider";
import type { RadarAttribute, AnimationConfig } from "../../types/radar";
import { calculateRating, getRatingColor } from "../../lib/rating";

type AttributeEditorProps = {
  attributes: RadarAttribute[];
  animation: AnimationConfig;
  onChange: (attributes: RadarAttribute[]) => void;
  importMenu?: React.ReactNode;
};

export const AttributeEditor: React.FC<AttributeEditorProps> = ({
  attributes,
  animation,
  onChange,
  importMenu,
}) => {
  const t = useTranslations("editor.attributes");
  const updateAttribute = (
    index: number,
    field: keyof RadarAttribute,
    value: string | number,
  ) => {
    const next = [...attributes] as RadarAttribute[];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
        {importMenu}
      </div>
      {attributes.map((attr, i) => {
        const isHighValue = attr.value >= animation.highValueThreshold;
        const rating = calculateRating(attr.value);
        return (
          <div key={i} className="flex gap-3 items-start">
            {/* 左半：名称 + 评分 + 滑条 */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Input
                  value={attr.shortLabel}
                  onChange={(e) =>
                    updateAttribute(i, "shortLabel", e.target.value)
                  }
                  className="w-16 text-center text-xs"
                />
                <Input
                  value={attr.label}
                  onChange={(e) => updateAttribute(i, "label", e.target.value)}
                  className="flex-1 text-xs"
                  placeholder={t("namePlaceholder")}
                />
                <span
                  className={`text-sm font-mono w-8 text-right ${isHighValue ? "text-amber-400 font-bold" : "text-subtitle"}`}
                >
                  {attr.value}
                </span>
                <span
                  className="text-xs font-bold w-8"
                  style={{ color: getRatingColor(rating) }}
                >
                  {rating.full}
                </span>
              </div>
              <Slider
                value={[attr.value]}
                onValueChange={(v) => updateAttribute(i, "value", Array.isArray(v) ? v[0] : v)}
                min={0}
                max={200}
                step={1}
                className={`${isHighValue ? "[&_[role=slider]]:bg-amber-400" : ""}`}
              />
            </div>
            {/* 右半：XY 偏移 */}
            <div className="w-48 space-y-1">
              <span className="text-xs text-subtitle">{t("offsetX", { value: attr.labelOffsetX ?? 0 })}</span>
              <Slider
                value={[attr.labelOffsetX ?? 0]}
                onValueChange={(v) => updateAttribute(i, "labelOffsetX", Array.isArray(v) ? v[0] : v)}
                min={-200}
                max={200}
                step={1}
              />
              <span className="text-xs text-subtitle">{t("offsetY", { value: attr.labelOffsetY ?? 0 })}</span>
              <Slider
                value={[attr.labelOffsetY ?? 0]}
                onValueChange={(v) => updateAttribute(i, "labelOffsetY", Array.isArray(v) ? v[0] : v)}
                min={-200}
                max={200}
                step={1}
              />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-subtitle">
        {t("thresholdHint", { threshold: animation.highValueThreshold })}
      </p>
    </div>
  );
};
