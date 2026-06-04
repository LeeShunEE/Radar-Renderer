"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import type { RadarVideoProps, SlugConfig } from "../../types/radar";
import { FontSelect } from "./FontFamilyEditor";

type ImageOption = {
  name: string;
  path: string;
};

type CharacterConfigProps = {
  characterName: string;
  characterNameAlign: "left" | "center" | "right";
  characterNameFontSize: number;
  silhouetteSrc: string;
  silhouetteOpacity: number;
  silhouetteOffsetX: number;
  silhouetteOffsetY: number;
  silhouetteScale: number;
  characterNameOffsetX: number;
  characterNameOffsetY: number;
  syncSilhouetteOffset: boolean;
  slug: SlugConfig;
  layoutDisabled?: boolean;
  onChange: (updates: Partial<RadarVideoProps>) => void;
  importMenu?: React.ReactNode;
};

const LAYOUT_DISABLED_TOOLTIP = "对比模式下此页作为第二角色，布局跟随第一角色，此配置不会渲染";

export const CharacterConfig: React.FC<CharacterConfigProps> = ({
  characterName,
  characterNameAlign,
  characterNameFontSize,
  silhouetteSrc,
  silhouetteOpacity,
  silhouetteOffsetX,
  silhouetteOffsetY,
  silhouetteScale,
  characterNameOffsetX,
  characterNameOffsetY,
  syncSilhouetteOffset,
  slug,
  layoutDisabled,
  onChange,
  importMenu,
}) => {
  const updateSlug = (patch: Partial<SlugConfig>) => {
    onChange({ slug: { ...slug, ...patch } as SlugConfig });
  };
  const [images, setImages] = useState<ImageOption[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadImages = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/images", { cache: "no-store" });
      const data = await r.json();
      setImages(data);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const effectiveSilX = syncSilhouetteOffset ? characterNameOffsetX : silhouetteOffsetX;
  const effectiveSilY = syncSilhouetteOffset ? characterNameOffsetY : silhouetteOffsetY;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">角色配置</h3>
        {importMenu}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* 左列 */}
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="charName">角色名称</Label>
              <div className="flex items-center gap-1">
                {(["left", "center", "right"] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => onChange({ characterNameAlign: align })}
                    className={`text-xs px-2 py-0.5 rounded border ${
                      characterNameAlign === align
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-input text-subtitle hover:text-foreground"
                    }`}
                    title={`对齐：${align === "left" ? "左" : align === "right" ? "右" : "中"}`}
                  >
                    {align === "left" ? "左" : align === "right" ? "右" : "中"}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              id="charName"
              value={characterName}
              onChange={(e) => onChange({ characterName: e.target.value })}
              placeholder={'输入角色名称（支持 \\n 换行）'}
              rows={2}
              className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
            />
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">字号</Label>
              <Input
                type="number"
                min={30}
                max={180}
                value={characterNameFontSize}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isNaN(n)) return;
                  onChange({
                    font: { characterName: Math.max(30, Math.min(180, n)) } as any,
                  });
                }}
                className="h-7 w-20 text-xs"
              />
              <Slider
                value={[characterNameFontSize]}
                onValueChange={(v) =>
                  onChange({
                    font: { characterName: Array.isArray(v) ? v[0] : v } as any,
                  })
                }
                min={30}
                max={180}
                step={1}
                className="flex-1"
              />
            </div>
          </div>
          <div
            title={layoutDisabled ? LAYOUT_DISABLED_TOOLTIP : undefined}
            className={layoutDisabled ? "opacity-40 pointer-events-none" : ""}
          >
            <div className="space-y-1">
              <Label className="text-xs">名称 X 偏移: {characterNameOffsetX}</Label>
              <Slider
                value={[characterNameOffsetX]}
                onValueChange={(v) =>
                  onChange({ layout: { characterNameOffsetX: Array.isArray(v) ? v[0] : v } as any })
                }
                min={-500}
                max={500}
                step={1}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">名称 Y 偏移: {characterNameOffsetY}</Label>
              <Slider
                value={[characterNameOffsetY]}
                onValueChange={(v) =>
                  onChange({ layout: { characterNameOffsetY: Array.isArray(v) ? v[0] : v } as any })
                }
                min={-500}
                max={500}
                step={1}
              />
            </div>
          </div>

          {/* Slug 标语 */}
          <div className="space-y-2 pt-1 border-t border-unfocused-border-color">
            <div className="flex items-center justify-between pt-2">
              <Label className="text-xs font-semibold">Slug 标语（左上）</Label>
              <span className="text-[10px] text-subtitle">支持 \n 换行</span>
            </div>
            <textarea
              value={slug.text}
              onChange={(e) => updateSlug({ text: e.target.value })}
              placeholder="例如：Gemini 3.1 Pro"
              rows={2}
              className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
            />
            <div className="flex items-center gap-2">
              <Label className="text-xs w-10 shrink-0">字体</Label>
              <div className="flex-1 min-w-0">
                <FontSelect
                  value={slug.fontFamily}
                  onChange={(name) => updateSlug({ fontFamily: name })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs w-10 shrink-0">字号</Label>
              <Input
                type="number"
                min={8}
                max={200}
                value={slug.fontSize}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isNaN(n)) return;
                  updateSlug({ fontSize: Math.max(8, Math.min(200, n)) });
                }}
                className="h-7 w-16 text-xs"
              />
              <Slider
                value={[slug.fontSize]}
                onValueChange={(v) =>
                  updateSlug({ fontSize: Array.isArray(v) ? v[0] : v })
                }
                min={8}
                max={200}
                step={1}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs w-10 shrink-0">颜色</Label>
              <Input
                type="color"
                value={slug.color}
                onChange={(e) => updateSlug({ color: e.target.value })}
                className="h-7 w-12 p-0.5"
              />
              <Input
                value={slug.color}
                onChange={(e) => updateSlug({ color: e.target.value })}
                className="h-7 text-xs flex-1"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Slug X 偏移: {slug.offsetX}</Label>
              <Slider
                value={[slug.offsetX]}
                onValueChange={(v) =>
                  updateSlug({ offsetX: Array.isArray(v) ? v[0] : v })
                }
                min={-1000}
                max={1000}
                step={1}
              />
              <Label className="text-xs">Slug Y 偏移: {slug.offsetY}</Label>
              <Slider
                value={[slug.offsetY]}
                onValueChange={(v) =>
                  updateSlug({ offsetY: Array.isArray(v) ? v[0] : v })
                }
                min={-1000}
                max={1000}
                step={1}
              />
              <Label className="text-xs">
                淡入延迟: {slug.fadeOffsetFrames ?? 0} 帧
              </Label>
              <Slider
                value={[slug.fadeOffsetFrames ?? 0]}
                onValueChange={(v) =>
                  updateSlug({ fadeOffsetFrames: Array.isArray(v) ? v[0] : v })
                }
                min={-120}
                max={120}
                step={1}
              />
            </div>
          </div>
        </div>
        {/* 右列 */}
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>选择图片</Label>
              <button
                type="button"
                onClick={loadImages}
                disabled={refreshing}
                title="刷新图片列表"
                className="inline-flex items-center gap-1 text-xs text-subtitle hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw
                  size={12}
                  className={refreshing ? "animate-spin" : ""}
                />
                刷新
              </button>
            </div>
            {images.length === 0 ? (
              <p className="text-xs text-muted-foreground">加载中…</p>
            ) : (
              <div className="grid grid-cols-5 gap-1.5">
                {images.map((img) => {
                  const selected = silhouetteSrc === img.path;
                  return (
                    <button
                      key={img.path}
                      type="button"
                      onClick={() => onChange({ silhouetteSrc: img.path })}
                      className={`rounded-lg border-2 p-1 transition-all ${
                        selected
                          ? "border-primary scale-105 opacity-100"
                          : "border-transparent opacity-50 hover:opacity-80 hover:border-muted-foreground/30"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/${img.path}`}
                        alt={img.name}
                        className="mx-auto max-h-12 object-contain"
                        loading="lazy"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">剪影透明度: {Math.round(silhouetteOpacity * 100)}%</Label>
            <Slider
              value={[silhouetteOpacity]}
              onValueChange={(v) =>
                onChange({ theme: { silhouetteOpacity: Array.isArray(v) ? v[0] : v } as any })
              }
              min={0}
              max={1}
              step={0.01}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">剪影缩放: {silhouetteScale.toFixed(2)}x</Label>
            <Slider
              value={[silhouetteScale]}
              onValueChange={(v) =>
                onChange({ layout: { silhouetteScale: Array.isArray(v) ? v[0] : v } as any })
              }
              min={0.2}
              max={3}
              step={0.01}
            />
          </div>
          <div
            title={layoutDisabled ? LAYOUT_DISABLED_TOOLTIP : undefined}
            className={layoutDisabled ? "opacity-40 pointer-events-none" : ""}
          >
            <div className="flex items-center justify-between">
              <Label className="text-xs">同步剪影与名称偏移</Label>
              <Switch
                checked={syncSilhouetteOffset}
                onCheckedChange={(v) =>
                  onChange({ layout: { syncSilhouetteOffset: v } as any })
                }
              />
            </div>
            <div className={`flex gap-2 ${syncSilhouetteOffset ? "opacity-40 pointer-events-none" : ""}`}>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">剪影 X</Label>
                  <Input
                    type="number"
                    min={-500}
                    max={500}
                    value={effectiveSilX}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isNaN(n)) return;
                      onChange({ layout: { silhouetteOffsetX: Math.max(-500, Math.min(500, n)) } as any });
                    }}
                    className="h-6 w-16 text-xs px-1 text-right"
                  />
                </div>
                <Slider
                  value={[effectiveSilX]}
                  onValueChange={(v) =>
                    onChange({ layout: { silhouetteOffsetX: Array.isArray(v) ? v[0] : v } as any })
                  }
                  min={-500}
                  max={500}
                  step={1}
                />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">剪影 Y</Label>
                  <Input
                    type="number"
                    min={-500}
                    max={500}
                    value={effectiveSilY}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isNaN(n)) return;
                      onChange({ layout: { silhouetteOffsetY: Math.max(-500, Math.min(500, n)) } as any });
                    }}
                    className="h-6 w-16 text-xs px-1 text-right"
                  />
                </div>
                <Slider
                  value={[effectiveSilY]}
                  onValueChange={(v) =>
                    onChange({ layout: { silhouetteOffsetY: Array.isArray(v) ? v[0] : v } as any })
                  }
                  min={-500}
                  max={500}
                  step={1}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="silhouetteSrc">图片路径</Label>
            <Input
              id="silhouetteSrc"
              value={silhouetteSrc}
              onChange={(e) => onChange({ silhouetteSrc: e.target.value })}
              placeholder="silhouettes/hero.png"
            />
          </div>
        </div>
      </div>

    </div>
  );
};
