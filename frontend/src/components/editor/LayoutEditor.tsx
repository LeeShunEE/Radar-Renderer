"use client";

import React from "react";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import type { LayoutConfig } from "../../types/radar";

type LayoutEditorProps = {
  layout: LayoutConfig;
  onChange: (layout: LayoutConfig) => void;
  disabled?: boolean;
  importMenu?: React.ReactNode;
};

const DISABLED_TOOLTIP = "对比模式下此页作为第二角色，布局跟随第一角色，此配置不会渲染";

export const LayoutEditor: React.FC<LayoutEditorProps> = ({
  layout,
  onChange,
  disabled,
  importMenu,
}) => {
  const update = <K extends keyof LayoutConfig>(
    key: K,
    value: LayoutConfig[K],
  ) => {
    onChange({ ...layout, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">布局配置</h3>
        {importMenu}
      </div>
      <div
        title={disabled ? DISABLED_TOOLTIP : undefined}
        className={disabled ? "opacity-40 pointer-events-none" : ""}
      >
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">雷达 X: {layout.radarCX}</Label>
          <Slider
            value={[layout.radarCX]}
            onValueChange={(v) => update("radarCX", Array.isArray(v) ? v[0] : v)}
            min={200}
            max={1800}
            step={1}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">雷达 Y: {layout.radarCY}</Label>
          <Slider
            value={[layout.radarCY]}
            onValueChange={(v) => update("radarCY", Array.isArray(v) ? v[0] : v)}
            min={100}
            max={900}
            step={1}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">网格环数: {layout.gridRingCount}</Label>
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
            网格线宽: {layout.gridStrokeWidth.toFixed(1)}
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
