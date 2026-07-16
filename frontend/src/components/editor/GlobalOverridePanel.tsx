"use client";

import React, { useState } from "react";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Slider } from "../ui/slider";
import { Label } from "../ui/label";
import { FontSelect } from "./FontFamilyEditor";
import { isVideoPage } from "../../types/radar";
import type { GlobalOverrideConfig, MultiPageConfig, RadarVideoProps } from "../../types/radar";
import { defaultRadarProps } from "../../types/constants";
import {
  OVERRIDE_GROUPS,
  type OverrideField,
  getByPath,
  setByPath,
} from "../../lib/global-override";

type Props = {
  config: MultiPageConfig;
  onChange: (next: MultiPageConfig) => void;
};

const isFontField = (path: string) => path.endsWith("Family") || path === "slug.fontFamily";

export const GlobalOverridePanel: React.FC<Props> = ({ config, onChange }) => {
  // 覆写仅作用于雷达页：fallback values 取第一个雷达页，全视频页时用默认雷达配置
  const override: GlobalOverrideConfig = config.globalOverride ?? {
    enabled: {},
    values: config.pages.find((p): p is RadarVideoProps => !isVideoPage(p)) ?? defaultRadarProps,
  };
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const setOverride = (next: GlobalOverrideConfig) => {
    onChange({ ...config, globalOverride: next });
  };

  const toggleEnabled = (path: string, on: boolean) => {
    setOverride({
      ...override,
      enabled: { ...override.enabled, [path]: on },
    });
  };

  const setValue = (path: string, value: unknown) => {
    setOverride({
      ...override,
      values: setByPath(override.values, path, value),
    });
  };

  const enabledCount = Object.values(override.enabled).filter(Boolean).length;

  const renderControl = (field: OverrideField) => {
    const enabled = !!override.enabled[field.path];
    const value = getByPath(override.values, field.path);
    const disabled = !enabled;

    if (field.type.kind === "boolean") {
      return (
        <Switch
          checked={!!value}
          onCheckedChange={(v) => setValue(field.path, v)}
          disabled={disabled}
        />
      );
    }
    if (field.type.kind === "color") {
      return (
        <div className="flex items-center gap-1">
          <Input
            type="color"
            value={String(value ?? "#000000")}
            onChange={(e) => setValue(field.path, e.target.value)}
            disabled={disabled}
            className="h-7 w-10 p-0.5"
          />
          <Input
            value={String(value ?? "")}
            onChange={(e) => setValue(field.path, e.target.value)}
            disabled={disabled}
            className="h-7 text-xs w-24"
          />
        </div>
      );
    }
    if (field.type.kind === "number") {
      const { min, max, step = 1 } = field.type;
      const num = Number(value ?? 0);
      return (
        <div
          className={`flex items-center gap-2 w-56 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        >
          <Slider
            value={[num]}
            onValueChange={(v) => {
              const n = Array.isArray(v) ? v[0] : v;
              setValue(field.path, n);
            }}
            min={min}
            max={max}
            step={step}
            className="flex-1"
          />
          <Input
            type="number"
            min={min}
            max={max}
            step={step}
            value={num}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isNaN(n)) return;
              setValue(field.path, Math.max(min, Math.min(max, n)));
            }}
            className="h-7 text-xs w-16 px-1 text-right"
          />
        </div>
      );
    }
    if (field.type.kind === "enum") {
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => setValue(field.path, e.target.value)}
          disabled={disabled}
          className="h-7 text-xs rounded border border-input bg-transparent px-2 disabled:opacity-50"
        >
          {field.type.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    // string
    if (isFontField(field.path)) {
      return (
        <div className={`w-40 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
          <FontSelect
            value={String(value ?? "")}
            onChange={(name) => setValue(field.path, name)}
          />
        </div>
      );
    }
    return (
      <Input
        value={String(value ?? "")}
        onChange={(e) => setValue(field.path, e.target.value)}
        disabled={disabled}
        className="h-7 text-xs w-40"
      />
    );
  };

  return (
    <div className="space-y-3 border border-unfocused-border-color rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            全局覆盖（Global Override）
          </h3>
          <p className="text-[11px] text-subtitle mt-0.5">
            勾选某个字段后，所有页面在渲染时都会使用此处的值覆盖各自的设置（不会修改页面原始数据）。当前启用 {enabledCount} 项。
          </p>
        </div>
        {enabledCount > 0 && (
          <button
            type="button"
            onClick={() => setOverride({ ...override, enabled: {} })}
            className="text-[11px] px-2 py-1 rounded border border-unfocused-border-color text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            全部关闭
          </button>
        )}
      </div>

      <div className="space-y-2">
        {OVERRIDE_GROUPS.map((group) => {
          const groupEnabled = group.fields.filter(
            (f) => override.enabled[f.path],
          ).length;
          const isCollapsed = collapsed[group.title] ?? true;
          return (
            <div
              key={group.title}
              className="border border-unfocused-border-color rounded"
            >
              <button
                type="button"
                onClick={() =>
                  setCollapsed((p) => ({ ...p, [group.title]: !isCollapsed }))
                }
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {isCollapsed ? "▸" : "▾"}
                  </span>
                  <span className="text-xs font-medium">{group.title}</span>
                  {groupEnabled > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                      {groupEnabled} / {group.fields.length}
                    </span>
                  )}
                </div>
              </button>
              {!isCollapsed && (
                <div className="border-t border-unfocused-border-color px-3 py-2 space-y-1.5">
                  {group.fields.map((field) => {
                    const enabled = !!override.enabled[field.path];
                    return (
                      <div
                        key={field.path}
                        className={`flex items-center gap-2 ${
                          enabled ? "" : "opacity-60"
                        }`}
                      >
                        <Switch
                          checked={enabled}
                          onCheckedChange={(v) => toggleEnabled(field.path, v)}
                        />
                        <Label className="text-xs flex-1">{field.label}</Label>
                        {renderControl(field)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
