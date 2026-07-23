"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { AssetSelector } from "../files/AssetSelector";
import type { RadarVideoProps, SlugConfig } from "../../types/radar";
import { FontSelect } from "./FontFamilyEditor";

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
  const t = useTranslations("editor.character");
  const layoutDisabledTip = t("layoutDisabledTip");
  const updateSlug = (patch: Partial<SlugConfig>) => {
    onChange({ slug: { ...slug, ...patch } as SlugConfig });
  };

  const effectiveSilX = syncSilhouetteOffset ? characterNameOffsetX : silhouetteOffsetX;
  const effectiveSilY = syncSilhouetteOffset ? characterNameOffsetY : silhouetteOffsetY;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
        {importMenu}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* 左列 */}
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="charName">{t("nameLabel")}</Label>
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
                    title={t(`alignTip.${align}`)}
                  >
                    {t(`align.${align}`)}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              id="charName"
              value={characterName}
              onChange={(e) => onChange({ characterName: e.target.value })}
              placeholder={t("namePlaceholder")}
              rows={2}
              className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
            />
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">{t("fontSize")}</Label>
              <Input
                type="number"
                min={30}
                max={180}
                value={characterNameFontSize}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isNaN(n)) return;
                  onChange({
                    font: { characterName: Math.max(30, Math.min(180, n)) },
                  } as Partial<RadarVideoProps>);
                }}
                className="h-7 w-20 text-xs"
              />
              <Slider
                value={[characterNameFontSize]}
                onValueChange={(v) =>
                  onChange({
                    font: { characterName: Array.isArray(v) ? v[0] : v },
                  } as Partial<RadarVideoProps>)
                }
                min={30}
                max={180}
                step={1}
                className="flex-1"
              />
            </div>
          </div>
          <div
            title={layoutDisabled ? layoutDisabledTip : undefined}
            className={layoutDisabled ? "opacity-40 pointer-events-none" : ""}
          >
            <div className="space-y-1">
              <Label className="text-xs">{t("nameOffsetX", { value: characterNameOffsetX })}</Label>
              <Slider
                value={[characterNameOffsetX]}
                onValueChange={(v) =>
                  onChange({ layout: { characterNameOffsetX: Array.isArray(v) ? v[0] : v } } as Partial<RadarVideoProps>)
                }
                min={-500}
                max={500}
                step={1}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("nameOffsetY", { value: characterNameOffsetY })}</Label>
              <Slider
                value={[characterNameOffsetY]}
                onValueChange={(v) =>
                  onChange({ layout: { characterNameOffsetY: Array.isArray(v) ? v[0] : v } } as Partial<RadarVideoProps>)
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
              <Label className="text-xs font-semibold">{t("slug.title")}</Label>
              <span className="text-[10px] text-subtitle">{t("slug.newlineHint")}</span>
            </div>
            <textarea
              value={slug.text}
              onChange={(e) => updateSlug({ text: e.target.value })}
              placeholder={t("slug.placeholder")}
              rows={2}
              className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
            />
            <div className="flex items-center gap-2">
              <Label className="text-xs w-10 shrink-0">{t("slug.font")}</Label>
              <div className="flex-1 min-w-0">
                <FontSelect
                  value={slug.fontFamily}
                  onChange={(name) => updateSlug({ fontFamily: name })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs w-10 shrink-0">{t("slug.fontSize")}</Label>
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
              <Label className="text-xs w-10 shrink-0">{t("slug.color")}</Label>
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
              <Label className="text-xs">{t("slug.offsetX", { value: slug.offsetX })}</Label>
              <Slider
                value={[slug.offsetX]}
                onValueChange={(v) =>
                  updateSlug({ offsetX: Array.isArray(v) ? v[0] : v })
                }
                min={-1000}
                max={1000}
                step={1}
              />
              <Label className="text-xs">{t("slug.offsetY", { value: slug.offsetY })}</Label>
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
                {t("slug.fadeDelay", { value: slug.fadeOffsetFrames ?? 0 })}
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
          {/* 剪影选择器 */}
          <AssetSelector
            category="silhouettes"
            value={silhouetteSrc}
            onChange={(path) => onChange({ silhouetteSrc: path })}
          />
          <div className="space-y-1">
            <Label className="text-xs">{t("silhouette.opacity", { value: Math.round(silhouetteOpacity * 100) })}</Label>
            <Slider
              value={[silhouetteOpacity]}
              onValueChange={(v) =>
                onChange({ theme: { silhouetteOpacity: Array.isArray(v) ? v[0] : v } } as Partial<RadarVideoProps>)
              }
              min={0}
              max={1}
              step={0.01}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("silhouette.scale", { value: silhouetteScale.toFixed(2) })}</Label>
            <Slider
              value={[silhouetteScale]}
              onValueChange={(v) =>
                onChange({ layout: { silhouetteScale: Array.isArray(v) ? v[0] : v } } as Partial<RadarVideoProps>)
              }
              min={0.2}
              max={3}
              step={0.01}
            />
          </div>
          <div
            title={layoutDisabled ? layoutDisabledTip : undefined}
            className={layoutDisabled ? "opacity-40 pointer-events-none" : ""}
          >
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("silhouette.syncOffset")}</Label>
              <Switch
                checked={syncSilhouetteOffset}
                onCheckedChange={(v) =>
                  onChange({ layout: { syncSilhouetteOffset: v } } as Partial<RadarVideoProps>)
                }
              />
            </div>
            <div className={`flex gap-2 ${syncSilhouetteOffset ? "opacity-40 pointer-events-none" : ""}`}>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("silhouette.offsetX")}</Label>
                  <Input
                    type="number"
                    min={-500}
                    max={500}
                    value={effectiveSilX}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isNaN(n)) return;
                      onChange({ layout: { silhouetteOffsetX: Math.max(-500, Math.min(500, n)) } } as Partial<RadarVideoProps>);
                    }}
                    className="h-6 w-16 text-xs px-1 text-right"
                  />
                </div>
                <Slider
                  value={[effectiveSilX]}
                  onValueChange={(v) =>
                    onChange({ layout: { silhouetteOffsetX: Array.isArray(v) ? v[0] : v } } as Partial<RadarVideoProps>)
                  }
                  min={-500}
                  max={500}
                  step={1}
                />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("silhouette.offsetY")}</Label>
                  <Input
                    type="number"
                    min={-500}
                    max={500}
                    value={effectiveSilY}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isNaN(n)) return;
                      onChange({ layout: { silhouetteOffsetY: Math.max(-500, Math.min(500, n)) } } as Partial<RadarVideoProps>);
                    }}
                    className="h-6 w-16 text-xs px-1 text-right"
                  />
                </div>
                <Slider
                  value={[effectiveSilY]}
                  onValueChange={(v) =>
                    onChange({ layout: { silhouetteOffsetY: Array.isArray(v) ? v[0] : v } } as Partial<RadarVideoProps>)
                  }
                  min={-500}
                  max={500}
                  step={1}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="silhouetteSrc">{t("silhouette.imagePath")}</Label>
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
