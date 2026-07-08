"use client";

import React, { useEffect, useRef } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import type { MultiPageConfig, RadarAttribute, RadarVideoProps } from "../../types/radar";
import { calculateRating, getRatingColor } from "../../lib/rating";

type Props = {
  config: MultiPageConfig;
  onChange: (next: MultiPageConfig) => void;
  activePageIndex: number;
  onSetActive: (index: number) => void;
  onAddPage?: () => void;
};

const clampValue = (v: number) => Math.max(0, Math.min(200, v));

type WheelValueInputProps = {
  value: number;
  onChange: (next: number) => void;
};

const WheelValueInput: React.FC<WheelValueInputProps> = ({ value, onChange }) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (document.activeElement !== el) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : e.altKey ? 0.5 : 1;
      const delta = e.deltaY < 0 ? step : -step;
      onChange(clampValue(value + delta));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [value, onChange]);

  return (
    <Input
      ref={ref}
      type="number"
      min={0}
      max={200}
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        const n = raw === "" ? 0 : Number(raw);
        if (Number.isNaN(n)) return;
        onChange(clampValue(n));
      }}
      className="h-6 w-14 text-xs px-1 text-right"
      title="聚焦后滚轮调整：Shift=±10，Alt=±0.5"
    />
  );
};

export const RadarValuesTable: React.FC<Props> = ({
  config,
  onChange,
  activePageIndex,
  onSetActive,
  onAddPage,
}) => {
  const headerPage = config.pages[0];
  if (!headerPage) return null;

  const updatePage = (pageIndex: number, updates: Partial<RadarVideoProps>) => {
    const pages = [...config.pages];
    pages[pageIndex] = { ...pages[pageIndex], ...updates };
    onChange({ ...config, pages });
    if (pageIndex !== activePageIndex) onSetActive(pageIndex);
  };

  const updateAttribute = (
    pageIndex: number,
    attrIndex: number,
    patch: Partial<RadarAttribute>,
  ) => {
    const pages = [...config.pages];
    const attrs = [...pages[pageIndex].attributes] as RadarVideoProps["attributes"];
    attrs[attrIndex] = { ...attrs[attrIndex], ...patch };
    pages[pageIndex] = { ...pages[pageIndex], attributes: attrs };
    onChange({ ...config, pages });
    if (pageIndex !== activePageIndex) onSetActive(pageIndex);
  };

  const updateHeaderLabel = (
    attrIndex: number,
    field: "label" | "shortLabel",
    value: string,
  ) => {
    const pages = config.pages.map((page) => {
      const attrs = [...page.attributes] as RadarVideoProps["attributes"];
      attrs[attrIndex] = { ...attrs[attrIndex], [field]: value };
      return { ...page, attributes: attrs };
    });
    onChange({ ...config, pages });
  };

  const swapAttributeColumns = (a: number, b: number) => {
    if (a === b) return;
    const pages = config.pages.map((page) => {
      const attrs = [...page.attributes] as RadarVideoProps["attributes"];
      [attrs[a], attrs[b]] = [attrs[b], attrs[a]];
      return { ...page, attributes: attrs };
    });
    onChange({ ...config, pages });
  };

  const syncLabelsFromFirstPage = () => {
    const first = config.pages[0];
    const pages = config.pages.map((page, i) => {
      if (i === 0) return page;
      const attrs = page.attributes.map((a, idx) => ({
        ...a,
        label: first.attributes[idx].label,
        shortLabel: first.attributes[idx].shortLabel,
      })) as RadarVideoProps["attributes"];
      return { ...page, attributes: attrs };
    });
    onChange({ ...config, pages });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">雷达数值表</h3>
        <div className="relative group">
          <Button
            variant="outline"
            size="sm"
            onClick={syncLabelsFromFirstPage}
          >
            同步表头到全部页面
          </Button>
          <div
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full mt-1 z-20 hidden group-hover:block w-64 rounded border border-unfocused-border-color bg-card p-2 text-xs text-foreground shadow-md"
          >
            将第 1 页（首行）的各属性「简称」与「全称」复制到其余所有页面的对应列，
            使全部页面共用同一套表头；各页数值不受影响。
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-unfocused-border-color">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-muted/40">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/60 px-2 py-2 text-left font-medium border-b border-r border-unfocused-border-color min-w-[200px]">
                角色 / 属性
              </th>
              {headerPage.attributes.map((attr, i) => {
                const total = headerPage.attributes.length;
                return (
                  <th
                    key={i}
                    className="px-1 py-1 border-b border-r border-unfocused-border-color align-top min-w-[88px]"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-0.5">
                        <button
                          type="button"
                          onClick={() => swapAttributeColumns(i, i - 1)}
                          disabled={i === 0}
                          title="与左侧列交换"
                          className="text-[10px] w-4 h-4 rounded text-subtitle hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          ◀
                        </button>
                        <span className="text-[10px] text-subtitle">#{i + 1}</span>
                        <button
                          type="button"
                          onClick={() => swapAttributeColumns(i, i + 1)}
                          disabled={i === total - 1}
                          title="与右侧列交换"
                          className="text-[10px] w-4 h-4 rounded text-subtitle hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          ▶
                        </button>
                      </div>
                      <Input
                        value={attr.shortLabel}
                        onChange={(e) => updateHeaderLabel(i, "shortLabel", e.target.value)}
                        className="h-6 text-center text-xs px-1"
                        placeholder="简称"
                      />
                      <Input
                        value={attr.label}
                        onChange={(e) => updateHeaderLabel(i, "label", e.target.value)}
                        className="h-6 text-center text-xs px-1"
                        placeholder="全称"
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {config.pages.map((page, pageIndex) => {
              const isActive = pageIndex === activePageIndex;
              return (
                <tr
                  key={pageIndex}
                  className={isActive ? "bg-accent/20" : "hover:bg-accent/10"}
                  onFocus={() => {
                    if (pageIndex !== activePageIndex) onSetActive(pageIndex);
                  }}
                  onMouseDown={() => {
                    if (pageIndex !== activePageIndex) onSetActive(pageIndex);
                  }}
                >
                  <td className="sticky left-0 z-10 bg-background px-2 py-1 border-b border-r border-unfocused-border-color min-w-[200px]">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSetActive(pageIndex)}
                        className={`text-xs px-1 rounded ${
                          isActive ? "text-amber-400 font-bold" : "text-subtitle hover:text-foreground"
                        }`}
                        title="设为预览页"
                      >
                        {pageIndex + 1}
                      </button>
                      <Input
                        value={page.characterName}
                        onChange={(e) =>
                          updatePage(pageIndex, { characterName: e.target.value })
                        }
                        className="h-6 text-xs px-2 flex-1 min-w-0"
                        placeholder="角色名"
                      />
                    </div>
                  </td>
                  {page.attributes.map((attr, attrIndex) => {
                    const rating = calculateRating(attr.value);
                    return (
                      <td
                        key={attrIndex}
                        className="px-1 py-1 border-b border-r border-unfocused-border-color"
                      >
                        <div className="flex items-center gap-1">
                          <WheelValueInput
                            value={attr.value}
                            onChange={(n) =>
                              updateAttribute(pageIndex, attrIndex, { value: n })
                            }
                          />
                          <span
                            className="text-xs font-bold w-7 text-center"
                            style={{ color: getRatingColor(rating) }}
                          >
                            {rating.full}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {onAddPage && (
        <Button variant="outline" size="sm" onClick={onAddPage}>
          ＋ 添加新页
        </Button>
      )}

      <p className="text-xs text-subtitle">
        数值范围 0–200。点击行首数字可将该页设为预览。修改首行属性名会同步覆盖所有页面的对应属性名。
        使用表头 ◀ ▶ 按钮可交换两列（对所有页面生效）。
      </p>
    </div>
  );
};
