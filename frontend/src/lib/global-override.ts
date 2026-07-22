import type { GlobalOverrideConfig, RadarVideoProps } from "../types/radar";

export type OverrideFieldType =
  | { kind: "number"; min: number; max: number; step?: number }
  | { kind: "string" }
  | { kind: "color" }
  | { kind: "boolean" }
  | { kind: "enum"; options: readonly string[] };

export type OverrideField = {
  path: string;
  type: OverrideFieldType;
};

export type OverrideGroup = {
  // i18n key slug（在 GlobalOverridePanel 里映射为 editor.override.groups.<titleKey>）；
  // 字段标签则由 path 派生（"." → "_"），不在此处存展示文案。
  titleKey: string;
  fields: OverrideField[];
};

// Fields safe to override across all pages. Identity fields (characterName,
// silhouetteSrc, attribute values) are intentionally omitted.
export const OVERRIDE_GROUPS: OverrideGroup[] = [
  {
    titleKey: "roleSlug",
    fields: [
      {
        path: "characterNameAlign",
        type: { kind: "enum", options: ["left", "center", "right"] },
      },
      { path: "slug.fontFamily", type: { kind: "string" } },
      { path: "slug.fontSize", type: { kind: "number", min: 8, max: 200 } },
      { path: "slug.color", type: { kind: "color" } },
      { path: "slug.offsetX", type: { kind: "number", min: -1000, max: 1000 } },
      { path: "slug.offsetY", type: { kind: "number", min: -1000, max: 1000 } },
      {
        path: "slug.fadeOffsetFrames",
        type: { kind: "number", min: -120, max: 120 },
      },
    ],
  },
  {
    titleKey: "theme",
    fields: [
      { path: "theme.backgroundColor", type: { kind: "color" } },
      { path: "theme.gridColor", type: { kind: "color" } },
      { path: "theme.gridFillColor", type: { kind: "color" } },
      { path: "theme.gridStrokeColor", type: { kind: "color" } },
      { path: "theme.dotColor", type: { kind: "color" } },
      { path: "theme.highValueDotColor", type: { kind: "color" } },
      { path: "theme.labelColor", type: { kind: "color" } },
      { path: "theme.valueColor", type: { kind: "color" } },
      { path: "theme.glowColor", type: { kind: "color" } },
      { path: "theme.enhanceArrowColor", type: { kind: "color" } },
      { path: "theme.weakenArrowColor", type: { kind: "color" } },
      {
        path: "theme.silhouetteOpacity",
        type: { kind: "number", min: 0, max: 1, step: 0.01 },
      },
      { path: "theme.vignetteEnabled", type: { kind: "boolean" } },
      {
        path: "theme.vignetteBrightness",
        type: { kind: "number", min: -100, max: 0 },
      },
      { path: "theme.vignetteCenterX", type: { kind: "number", min: 0, max: 100 } },
      { path: "theme.vignetteCenterY", type: { kind: "number", min: 0, max: 100 } },
      { path: "theme.vignetteInnerStop", type: { kind: "number", min: 0, max: 90 } },
      {
        path: "theme.vignetteOuterStop",
        type: { kind: "number", min: 10, max: 100 },
      },
    ],
  },
  {
    titleKey: "font",
    fields: [
      { path: "font.characterName", type: { kind: "number", min: 30, max: 180 } },
      { path: "font.characterNameFamily", type: { kind: "string" } },
      { path: "font.attributeLabel", type: { kind: "number", min: 18, max: 90 } },
      { path: "font.attributeLabelFamily", type: { kind: "string" } },
      { path: "font.ratingLabel", type: { kind: "number", min: 15, max: 75 } },
      { path: "font.ratingLabelFamily", type: { kind: "string" } },
      { path: "font.valuePopup", type: { kind: "number", min: 18, max: 75 } },
      { path: "font.valuePopupFamily", type: { kind: "string" } },
    ],
  },
  {
    titleKey: "animation",
    fields: [
      { path: "animation.fillDuration", type: { kind: "number", min: 10, max: 120 } },
      { path: "animation.silhouetteDelay", type: { kind: "number", min: 0, max: 60 } },
      { path: "animation.silhouetteFadeInDuration", type: { kind: "number", min: 5, max: 90 } },
      { path: "animation.labelStagger", type: { kind: "number", min: 0, max: 15 } },
      { path: "animation.highValueSpringDamping", type: { kind: "number", min: 2, max: 30 } },
      { path: "animation.holdDuration", type: { kind: "number", min: 0, max: 600 } },
      { path: "animation.nameFadeInDuration", type: { kind: "number", min: 5, max: 60 } },
      { path: "animation.nameAppearRatio", type: { kind: "number", min: 0, max: 1, step: 0.01 } },
      { path: "animation.labelStartOffset", type: { kind: "number", min: -60, max: 60 } },
      { path: "animation.fillStartOffset", type: { kind: "number", min: -60, max: 60 } },
      { path: "animation.effectsStartOffset", type: { kind: "number", min: -120, max: 60 } },
      { path: "animation.holdStartOffset", type: { kind: "number", min: -60, max: 60 } },
    ],
  },
  {
    titleKey: "effects",
    fields: [
      { path: "animation.highValueThreshold", type: { kind: "number", min: 50, max: 200 } },
      { path: "animation.valuePopupEnabled", type: { kind: "boolean" } },
      {
        path: "animation.valuePopupStyle",
        type: { kind: "enum", options: ["spring", "bounce", "fadeScale", "slideIn"] },
      },
      { path: "animation.highValueGlowEnabled", type: { kind: "boolean" } },
      {
        path: "animation.highValueGlowStyle",
        type: { kind: "enum", options: ["pulse", "ring", "ripple", "sparkle"] },
      },
    ],
  },
  {
    titleKey: "layout",
    fields: [
      { path: "layout.radarCX", type: { kind: "number", min: 200, max: 1800 } },
      { path: "layout.radarCY", type: { kind: "number", min: 100, max: 900 } },
      { path: "layout.gridRingCount", type: { kind: "number", min: 1, max: 10 } },
      { path: "layout.gridStrokeWidth", type: { kind: "number", min: 0.2, max: 8, step: 0.1 } },
      { path: "layout.silhouetteOffsetX", type: { kind: "number", min: -500, max: 500 } },
      { path: "layout.silhouetteOffsetY", type: { kind: "number", min: -500, max: 500 } },
      { path: "layout.silhouetteScale", type: { kind: "number", min: 0.2, max: 3, step: 0.01 } },
      { path: "layout.characterNameOffsetX", type: { kind: "number", min: -500, max: 500 } },
      { path: "layout.characterNameOffsetY", type: { kind: "number", min: -500, max: 500 } },
      { path: "layout.syncSilhouetteOffset", type: { kind: "boolean" } },
      {
        path: "layout.radarScale",
        type: { kind: "number", min: 0.3, max: 3, step: 0.01 },
      },
    ],
  },
  {
    titleKey: "labelOffset",
    fields: [
      { path: "layout.attributeLabelOffsetX", type: { kind: "number", min: -500, max: 500 } },
      { path: "layout.attributeLabelOffsetY", type: { kind: "number", min: -500, max: 500 } },
      { path: "layout.ratingLabelOffsetX", type: { kind: "number", min: -500, max: 500 } },
      { path: "layout.ratingLabelOffsetY", type: { kind: "number", min: -500, max: 500 } },
    ],
  },
];

export const ALL_OVERRIDE_FIELDS: OverrideField[] = OVERRIDE_GROUPS.flatMap(
  (g) => g.fields,
);

/**
 * 从对象中按点分隔路径获取值。
 * @param obj - 源对象
 * @param path - 点分隔的属性路径，如 "theme.backgroundColor"
 * @returns 路径处的值，不存在则返回 undefined
 */
export function getByPath<T extends object>(obj: T, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) =>
      acc == null ? acc : (acc as Record<string, unknown>)[key],
    obj,
  );
}

/**
 * 不可变地设置对象中按点分隔路径的值。
 * @param obj - 源对象
 * @param path - 点分隔的属性路径
 * @param value - 要设置的值
 * @returns 包含更新的对象浅拷贝
 */
export function setByPath<T extends object>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  // 使用类型断言实现不可变更新；路径访问的运行时安全性由调用方保证
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clone: any = Array.isArray(obj) ? [...(obj as unknown[])] : { ...obj };
  let cursor = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    cursor[k] = Array.isArray(cursor[k]) ? [...cursor[k]] : { ...cursor[k] };
    cursor = cursor[k];
  }
  cursor[keys[keys.length - 1]] = value;
  return clone;
}

export function applyGlobalOverride(
  page: RadarVideoProps,
  override: GlobalOverrideConfig | undefined,
): RadarVideoProps {
  if (!override) return page;
  const ignored = page.overrideIgnored ?? {};
  let next = page;
  for (const field of ALL_OVERRIDE_FIELDS) {
    if (!override.enabled[field.path]) continue;
    if (ignored[field.path]) continue;
    const value = getByPath(override.values, field.path);
    if (value === undefined) continue;
    next = setByPath(next, field.path, value);
  }
  return next;
}
