import type { GlobalOverrideConfig, RadarVideoProps } from "../types/radar";

export type OverrideFieldType =
  | { kind: "number"; min: number; max: number; step?: number }
  | { kind: "string" }
  | { kind: "color" }
  | { kind: "boolean" }
  | { kind: "enum"; options: readonly string[] };

export type OverrideField = {
  path: string;
  label: string;
  type: OverrideFieldType;
};

export type OverrideGroup = {
  title: string;
  fields: OverrideField[];
};

// Fields safe to override across all pages. Identity fields (characterName,
// silhouetteSrc, attribute values) are intentionally omitted.
export const OVERRIDE_GROUPS: OverrideGroup[] = [
  {
    title: "角色 / Slug",
    fields: [
      {
        path: "characterNameAlign",
        label: "角色名对齐",
        type: { kind: "enum", options: ["left", "center", "right"] },
      },
      { path: "slug.fontFamily", label: "Slug 字体", type: { kind: "string" } },
      {
        path: "slug.fontSize",
        label: "Slug 字号",
        type: { kind: "number", min: 8, max: 200 },
      },
      { path: "slug.color", label: "Slug 颜色", type: { kind: "color" } },
      {
        path: "slug.offsetX",
        label: "Slug X 偏移",
        type: { kind: "number", min: -1000, max: 1000 },
      },
      {
        path: "slug.offsetY",
        label: "Slug Y 偏移",
        type: { kind: "number", min: -1000, max: 1000 },
      },
      {
        path: "slug.fadeOffsetFrames",
        label: "Slug 淡入延迟",
        type: { kind: "number", min: -120, max: 120 },
      },
    ],
  },
  {
    title: "主题配色",
    fields: [
      { path: "theme.backgroundColor", label: "背景色", type: { kind: "color" } },
      { path: "theme.gridColor", label: "网格色", type: { kind: "color" } },
      { path: "theme.gridFillColor", label: "填充色", type: { kind: "color" } },
      { path: "theme.gridStrokeColor", label: "描边色", type: { kind: "color" } },
      { path: "theme.dotColor", label: "圆点色", type: { kind: "color" } },
      { path: "theme.highValueDotColor", label: "高属性圆点色", type: { kind: "color" } },
      { path: "theme.labelColor", label: "标签色", type: { kind: "color" } },
      { path: "theme.valueColor", label: "数值色", type: { kind: "color" } },
      { path: "theme.glowColor", label: "发光色", type: { kind: "color" } },
      { path: "theme.enhanceArrowColor", label: "增强箭头色", type: { kind: "color" } },
      { path: "theme.weakenArrowColor", label: "变弱箭头色", type: { kind: "color" } },
      {
        path: "theme.silhouetteOpacity",
        label: "剪影透明度",
        type: { kind: "number", min: 0, max: 1, step: 0.01 },
      },
      { path: "theme.vignetteEnabled", label: "暗角开启", type: { kind: "boolean" } },
      {
        path: "theme.vignetteBrightness",
        label: "暗角亮度",
        type: { kind: "number", min: -100, max: 0 },
      },
      {
        path: "theme.vignetteCenterX",
        label: "暗角中心 X",
        type: { kind: "number", min: 0, max: 100 },
      },
      {
        path: "theme.vignetteCenterY",
        label: "暗角中心 Y",
        type: { kind: "number", min: 0, max: 100 },
      },
      {
        path: "theme.vignetteInnerStop",
        label: "暗角内停",
        type: { kind: "number", min: 0, max: 90 },
      },
      {
        path: "theme.vignetteOuterStop",
        label: "暗角外停",
        type: { kind: "number", min: 10, max: 100 },
      },
    ],
  },
  {
    title: "字体",
    fields: [
      { path: "font.characterName", label: "角色名 字号", type: { kind: "number", min: 30, max: 180 } },
      { path: "font.characterNameFamily", label: "角色名 字体", type: { kind: "string" } },
      { path: "font.attributeLabel", label: "属性标签 字号", type: { kind: "number", min: 18, max: 90 } },
      { path: "font.attributeLabelFamily", label: "属性标签 字体", type: { kind: "string" } },
      { path: "font.ratingLabel", label: "评级 字号", type: { kind: "number", min: 15, max: 75 } },
      { path: "font.ratingLabelFamily", label: "评级 字体", type: { kind: "string" } },
      { path: "font.valuePopup", label: "数值弹出 字号", type: { kind: "number", min: 18, max: 75 } },
      { path: "font.valuePopupFamily", label: "数值弹出 字体", type: { kind: "string" } },
    ],
  },
  {
    title: "动画",
    fields: [
      { path: "animation.fillDuration", label: "填充时长", type: { kind: "number", min: 10, max: 120 } },
      { path: "animation.silhouetteDelay", label: "剪影延迟", type: { kind: "number", min: 0, max: 60 } },
      { path: "animation.silhouetteFadeInDuration", label: "剪影淡入", type: { kind: "number", min: 5, max: 90 } },
      { path: "animation.labelStagger", label: "标签错开", type: { kind: "number", min: 0, max: 15 } },
      { path: "animation.highValueSpringDamping", label: "高值弹簧阻尼", type: { kind: "number", min: 2, max: 30 } },
      { path: "animation.holdDuration", label: "保持时长", type: { kind: "number", min: 0, max: 600 } },
      { path: "animation.nameFadeInDuration", label: "名称淡入", type: { kind: "number", min: 5, max: 60 } },
      { path: "animation.nameAppearRatio", label: "名称出现比", type: { kind: "number", min: 0, max: 1, step: 0.01 } },
      { path: "animation.labelStartOffset", label: "标签起点偏移", type: { kind: "number", min: -60, max: 60 } },
      { path: "animation.fillStartOffset", label: "填充起点偏移", type: { kind: "number", min: -60, max: 60 } },
      { path: "animation.effectsStartOffset", label: "特效起点偏移", type: { kind: "number", min: -120, max: 60 } },
      { path: "animation.holdStartOffset", label: "保持起点偏移", type: { kind: "number", min: -60, max: 60 } },
    ],
  },
  {
    title: "特效",
    fields: [
      { path: "animation.highValueThreshold", label: "高值阈值", type: { kind: "number", min: 50, max: 200 } },
      { path: "animation.valuePopupEnabled", label: "数值弹出开启", type: { kind: "boolean" } },
      {
        path: "animation.valuePopupStyle",
        label: "弹出样式",
        type: { kind: "enum", options: ["spring", "bounce", "fadeScale", "slideIn"] },
      },
      { path: "animation.highValueGlowEnabled", label: "高值发光开启", type: { kind: "boolean" } },
      {
        path: "animation.highValueGlowStyle",
        label: "发光样式",
        type: { kind: "enum", options: ["pulse", "ring", "ripple", "sparkle"] },
      },
    ],
  },
  {
    title: "布局",
    fields: [
      { path: "layout.radarCX", label: "雷达 X", type: { kind: "number", min: 200, max: 1800 } },
      { path: "layout.radarCY", label: "雷达 Y", type: { kind: "number", min: 100, max: 900 } },
      { path: "layout.gridRingCount", label: "网格环数", type: { kind: "number", min: 1, max: 10 } },
      { path: "layout.gridStrokeWidth", label: "网格描边", type: { kind: "number", min: 0.2, max: 8, step: 0.1 } },
      { path: "layout.silhouetteOffsetX", label: "剪影 X 偏移", type: { kind: "number", min: -500, max: 500 } },
      { path: "layout.silhouetteOffsetY", label: "剪影 Y 偏移", type: { kind: "number", min: -500, max: 500 } },
      { path: "layout.silhouetteScale", label: "剪影缩放", type: { kind: "number", min: 0.2, max: 3, step: 0.01 } },
      { path: "layout.characterNameOffsetX", label: "名称 X 偏移", type: { kind: "number", min: -500, max: 500 } },
      { path: "layout.characterNameOffsetY", label: "名称 Y 偏移", type: { kind: "number", min: -500, max: 500 } },
      { path: "layout.syncSilhouetteOffset", label: "同步剪影/名称偏移", type: { kind: "boolean" } },
      {
        path: "layout.radarScale",
        label: "雷达缩放倍率",
        type: { kind: "number", min: 0.3, max: 3, step: 0.01 },
      },
    ],
  },
  {
    title: "标签全局偏移",
    fields: [
      {
        path: "layout.attributeLabelOffsetX",
        label: "属性名 X 偏移",
        type: { kind: "number", min: -500, max: 500 },
      },
      {
        path: "layout.attributeLabelOffsetY",
        label: "属性名 Y 偏移",
        type: { kind: "number", min: -500, max: 500 },
      },
      {
        path: "layout.ratingLabelOffsetX",
        label: "评级标签 X 偏移",
        type: { kind: "number", min: -500, max: 500 },
      },
      {
        path: "layout.ratingLabelOffsetY",
        label: "评级标签 Y 偏移",
        type: { kind: "number", min: -500, max: 500 },
      },
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
