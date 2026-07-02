/**
 * 【一次性单文件 Remotion 预览 · issue #17 对比模式（叠加 Overlay）动画设计审核用】
 *
 * 对比 = 同一个雷达图中叠加绘制两个八边形，配合「高亮」概念：
 *
 *   1. 双方八边形【同时】绘制（标签逐个淡入 → 多边形填充 → 顶点弹出 → 高值金点+光环）
 *   2. 左侧角色先高亮（右侧增加透明度压暗），高亮方各顶点弹出强弱三角箭头
 *      （▲更强 / ▼更弱，|差值| 大时双三角，与系统 DualRatingLabel 的 DiffBadge 同构）
 *   3. 右侧角色再高亮（左侧增加透明度压暗），同样弹出该方的强弱箭头
 *   4. 双方恢复正常 —— 都不高亮、也不透明；双方箭头常驻评级行两侧（不渲染数值差）
 *
 * 与现有系统保持一致的元素：
 *   - 角色剪影头像（Silhouette 同构；此处用内嵌 SVG 占位图，正式集成时换 silhouetteSrc）
 *   - slug 小字（系统在左上角；本预览左方放左上、右方镜像放右上）
 *   - 评级配色按数值 tier 走（getRatingColor 同构），不再按双方主题色区分归属
 *
 * 本文件完全独立，不依赖 frontend/src 内任何代码，自带 registerRoot 入口，
 * 可直接渲染完整视频：
 *
 *   cd frontend
 *   pnpm exec remotion render preview/comparison-preview.tsx ComparisonPreview out/comparison-preview.mp4
 *
 * 也可在 Studio 中交互式调参预览：
 *
 *   pnpm exec remotion studio preview/comparison-preview.tsx
 *
 * 所有可调参数集中在下方「手动配置区」，直接改常量即可。
 * 动画设计审核通过后，将按此设计正式融入现有系统（ComparisonConfig 扩展 +
 * Zod schema + 叠加图层组件 + UI 编辑器），届时删除本文件。
 */
import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Img,
  Sequence,
  interpolate,
  registerRoot,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/NotoSansSC";

const { fontFamily: FONT_FAMILY } = loadFont("normal", {
  weights: ["400", "700"],
  subsets: ["latin", "chinese-simplified"],
});

// ================================================================
// ★★★ 手动配置区：审核动画时只改这里 ★★★
// ================================================================

const VIDEO = { fps: 30, width: 1920, height: 1080 };

/** 布局：单个居中雷达图 */
const LAYOUT = {
  /** 单图缩放，1 = 原系统的 340px 最大半径 */
  chartScale: 0.95,
  centerY: 500,
  gridRingCount: 4,
  gridStrokeWidth: 1.5,
};

/** 高亮编排：双方绘制完成后，先高亮一方（另一方压暗），再换边，最后恢复正常 */
const HIGHLIGHT = {
  /** 先高亮哪一方 */
  order: "left-first" as "left-first" | "right-first",
  /** 双方绘制完成（顶点弹完）后到首次高亮的等待帧数 */
  delayAfterFill: 18,
  /** 高亮切换的渐变时长 */
  transitionFrames: 14,
  /** 每一方高亮的停留帧数 */
  holdFrames: 42,
  /** 被压暗一方的整体透明度 */
  dimOpacity: 0.15,
  /** 多边形填充 alpha：常态 → 高亮时 */
  baseFillAlpha: 0.25,
  emphasisFillAlpha: 0.45,
  /** 高亮方描边加粗量 */
  emphasisStrokeBonus: 2,
  /** 高亮方 drop-shadow 光晕半径（px） */
  glowRadius: 16,
  /** 左右两侧角色名被压暗时的透明度（比多边形留得亮些，保证可读） */
  nameDimOpacity: 0.3,
  /** 高亮方角色名放大倍率 */
  nameEmphasisScale: 1.12,
};

/** 左右两侧的角色名（带各自主题色圆点），高亮时同步强调 */
const NAMES = {
  show: true,
  fontSize: 56,
  /** 名字中心距画面中线的水平距离 */
  sideOffset: 665,
  fadeInFrames: 20,
  /** 名字出现时机 = fillStart + fillDuration * appearRatio */
  appearRatio: 0.7,
};

/** 双方角色剪影头像（与系统 Silhouette 同构：左右半屏各一居中；占位图为内嵌 SVG） */
const SILHOUETTE = {
  show: true,
  /** 常态透明度（系统默认 1，叠加图中调低避免压过雷达图） */
  baseOpacity: 0.4,
  /** 高亮时透明度 */
  emphasisOpacity: 0.85,
  /** 被压暗时透明度 */
  dimOpacity: 0.1,
  /** 高亮时缩放 */
  emphasisScale: 1.06,
  /** 入场淡入时长 */
  fadeInFrames: 25,
  offsetY: -40,
};

/** 双方 slug（与系统 slug 同构：小字标注；左方放左上角，右方镜像放右上角） */
const SLUG = {
  show: true,
  fontSize: 36,
  color: "#e2e8f0",
  /** 距画面左/右、上边缘的距离（系统为 left:80 top:80） */
  edgeOffset: 80,
  /** 相对角色名出现时机的额外延迟帧数 */
  fadeOffsetFrames: 6,
};

/**
 * 强弱箭头：某方高亮时在各顶点评级旁弹出 ▲（更强）/ ▼（更弱）；
 * 双方恢复正常后，两方箭头常驻评级行两侧（左方在左、右方在右），不渲染数值差
 */
const ARROWS = {
  show: true,
  /** 三角尺寸（px） */
  size: 24,
  /** |差值| 超过该阈值时显示双三角（与系统 DIFF_DOUBLE_THRESHOLD 一致） */
  doubleThreshold: 25,
  enhanceColor: "#ef4444",
  weakenColor: "#22c55e",
  /** 距属性标签锚点中线的水平距离（左方箭头在评级行左侧，右方在右侧） */
  sideOffset: 92,
  offsetY: 0,
};

/** 动画节奏（与现有系统 computePhaseStarts 同构；双方八边形共用同一节奏、同时绘制） */
const ANIMATION = {
  fillDuration: 45,
  labelStagger: 3,
  labelStartOffset: 0,
  fillStartOffset: -10,
  /** 顶点值 ≥ 阈值视为高值：金色大点 + 扩散光环 */
  highValueThreshold: 85,
  highValueGlowEnabled: true,
  highValueSpringDamping: 12,
};

/** 动画全部结束后的额外停留帧数 */
const HOLD_EXTRA = 70;

/** 字号 */
const FONT = {
  attributeLabel: 40,
  ratingLabel: 28,
};

/** 公共主题 */
const THEME = {
  backgroundColor: "#0a0a1a",
  vignetteBrightness: -30,
  gridColor: "rgba(255,255,255,0.12)",
  labelColor: "#e2e8f0",
  highValueDotColor: "#f59e0b",
  glowColor: "#f59e0b",
};

const ATTRIBUTE_LABELS = ["力量", "敏捷", "智力", "耐力", "魅力", "幸运", "防御", "速度"];

/** fillRGB 为 "r,g,b"，实际 alpha 由 HIGHLIGHT.baseFillAlpha / emphasisFillAlpha 控制 */
const LEFT_CHART = {
  name: "觉醒前",
  slug: "@radar/hero · 觉醒前档案",
  /** 剪影占位图的着色（正式集成时换成真实 silhouetteSrc） */
  silhouetteTint: "#818cf8",
  values: [70, 55, 85, 50, 62, 78, 40, 60],
  fillRGB: "99,102,241",
  strokeColor: "rgba(129,140,248,0.95)",
  dotColor: "#818cf8",
};

const RIGHT_CHART = {
  name: "觉醒后",
  slug: "@radar/hero · 觉醒后档案",
  silhouetteTint: "#f472b6",
  values: [88, 74, 90, 68, 60, 92, 55, 81],
  fillRGB: "236,72,153",
  strokeColor: "rgba(244,114,182,0.95)",
  dotColor: "#f472b6",
};

// ================================================================
// 以下为实现，审核动画时一般不需要动
// ================================================================

type ChartSpec = typeof LEFT_CHART;
type CharSide = "left" | "right";

// ─── 几何（与 frontend/src/lib/math.ts 同构） ───

const NUM_SIDES = 8;
const BASE_MAX_RADIUS = 340;
const CHART_RADIUS = BASE_MAX_RADIUS * LAYOUT.chartScale;
const MID_X = VIDEO.width / 2;

const getOctagonPoint = (index: number, radius: number) => {
  const angle = (2 * Math.PI * index) / NUM_SIDES - Math.PI / 2;
  return {
    x: MID_X + radius * Math.cos(angle),
    y: LAYOUT.centerY + radius * Math.sin(angle),
  };
};

const getPolygonPoints = (values: number[], maxRadius: number): string =>
  values
    .map((v, i) => {
      const { x, y } = getOctagonPoint(i, (v / 100) * maxRadius);
      return `${x},${y}`;
    })
    .join(" ");

/** 属性标签锚点（与 getRadarLabelAnchor 同构） */
const getLabelAnchor = (index: number) => {
  const distance =
    CHART_RADIUS + 30 + Math.max(FONT.attributeLabel, FONT.ratingLabel) * 0.8;
  const { x, y } = getOctagonPoint(index, distance);
  const yOffset = (FONT.attributeLabel + FONT.ratingLabel) * 0.5 + 6;
  return { x, y, yOffset };
};

// ─── 评级换算（与 frontend/src/lib/rating.ts 同构） ───

const RATING_TIERS: [number, string][] = [
  [200, "X"], [95, "SSS"], [90, "SS"], [85, "S"], [75, "A"],
  [60, "B"], [45, "C"], [30, "D"], [15, "E"], [0, "F"],
];
const RATING_MODIFIERS = ["--", "-", "", "+", "++"] as const;

type Rating = { base: string; full: string };

const calculateRating = (value: number): Rating => {
  for (let i = 0; i < RATING_TIERS.length; i++) {
    const [min, base] = RATING_TIERS[i];
    if (value >= min) {
      const nextMin = i === 0 ? 200 : RATING_TIERS[i - 1][0];
      if (base === "X" || base === "SSS" || base === "SS" || base === "F" || min === nextMin) {
        return { base, full: base };
      }
      const position = (value - min) / (nextMin - min);
      const bucket = Math.min(
        RATING_MODIFIERS.length - 1,
        Math.floor(position * RATING_MODIFIERS.length),
      );
      return { base, full: `${base}${RATING_MODIFIERS[bucket]}` };
    }
  }
  return { base: "F", full: "F" };
};

/** 评级配色按数值 tier 走（与 frontend/src/lib/rating.ts 的 RATING_COLORS 同构） */
const RATING_COLORS: Record<string, string> = {
  X: "#e040fb",
  SSS: "#ff6b6b",
  SS: "#ff8c42",
  S: "#ffa94d",
  A: "#ffd43b",
  B: "#69db7c",
  C: "#38d9a9",
  D: "#4dabf7",
  E: "#9775fa",
  F: "#868e96",
};

const getRatingColor = (rating: Rating): string =>
  RATING_COLORS[rating.base] ?? "#868e96";

// ─── 动画阶段（与 computePhaseStarts 同构 + 高亮编排） ───

const LABEL_START = 10 + ANIMATION.labelStartOffset;
const LABEL_END = LABEL_START + ANIMATION.labelStagger * NUM_SIDES;
const FILL_START = LABEL_END + ANIMATION.fillStartOffset;
const FILL_END = FILL_START + ANIMATION.fillDuration;
/** 顶点弹出全部落定 */
const DOTS_SETTLED = FILL_END + 30;

/** 高亮编排关键帧：P1→P2 首方渐入高亮，P3→P4 换边，P5→P6 恢复正常 */
const P1 = DOTS_SETTLED + HIGHLIGHT.delayAfterFill;
const P2 = P1 + HIGHLIGHT.transitionFrames;
const P3 = P2 + HIGHLIGHT.holdFrames;
const P4 = P3 + HIGHLIGHT.transitionFrames;
const P5 = P4 + HIGHLIGHT.holdFrames;
const P6 = P5 + HIGHLIGHT.transitionFrames;

const TOTAL_DURATION = P6 + HOLD_EXTRA;

const APPEAR_EASING = Easing.bezier(0.16, 1, 0.3, 1);

const FIRST_SIDE: CharSide = HIGHLIGHT.order === "left-first" ? "left" : "right";

const CLAMP_EASE = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.inOut(Easing.ease),
} as const;

/**
 * 某一方在当前帧的高亮状态：
 * - emphasis ∈ [0,1]：自己被高亮的程度（加粗描边、光晕、填充增浓）
 * - opacity ∈ [dimOpacity,1]：对方高亮时自己被压暗后的整体透明度
 */
const highlightStateAt = (frame: number, side: CharSide) => {
  const isFirst = side === FIRST_SIDE;
  const emphKeys = isFirst ? [P1, P2, P3, P4] : [P3, P4, P5, P6];
  const dimKeys = isFirst ? [P3, P4, P5, P6] : [P1, P2, P3, P4];
  const emphasis = interpolate(frame, emphKeys, [0, 1, 1, 0], CLAMP_EASE);
  const dim = interpolate(frame, dimKeys, [0, 1, 1, 0], CLAMP_EASE);
  return { emphasis, opacity: 1 - dim * (1 - HIGHLIGHT.dimOpacity) };
};

/** 某方强弱箭头的可见度：自己高亮时出现；双方恢复正常（P5→P6）后常驻 */
const arrowVisibilityAt = (frame: number, side: CharSide) => {
  const { emphasis } = highlightStateAt(frame, side);
  const restored = interpolate(frame, [P5, P6], [0, 1], CLAMP_EASE);
  return Math.max(emphasis, restored);
};

// ─── 背景 ───

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: APPEAR_EASING,
  });
  const edge = adjustBrightness(THEME.backgroundColor, THEME.vignetteBrightness);
  return (
    <AbsoluteFill
      style={{
        opacity,
        background: `radial-gradient(circle at 50% 50%, ${THEME.backgroundColor} 0%, ${edge} 100%)`,
      }}
    />
  );
};

function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ─── 雷达图子组件 ───

const RadarGrid: React.FC = () => {
  const rings = Array.from({ length: LAYOUT.gridRingCount }, (_, i) => {
    const level = (i + 1) / LAYOUT.gridRingCount;
    return getPolygonPoints(Array(NUM_SIDES).fill(level * 100), CHART_RADIUS);
  });
  const axisWidth = Math.max(0.1, LAYOUT.gridStrokeWidth * (2 / 3));
  return (
    <g>
      {rings.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke={THEME.gridColor}
          strokeWidth={LAYOUT.gridStrokeWidth}
        />
      ))}
      {Array.from({ length: NUM_SIDES }, (_, i) => {
        const end = getOctagonPoint(i, CHART_RADIUS);
        return (
          <line
            key={i}
            x1={MID_X} y1={LAYOUT.centerY} x2={end.x} y2={end.y}
            stroke={THEME.gridColor} strokeWidth={axisWidth}
          />
        );
      })}
    </g>
  );
};

/** 单方八边形：填充 + 描边；高亮时描边加粗、填充增浓、加光晕，被压暗时整体降透明度 */
const RadarFill: React.FC<{ spec: ChartSpec; side: CharSide }> = ({ spec, side }) => {
  const frame = useCurrentFrame();
  const { emphasis, opacity } = highlightStateAt(frame, side);

  const progress = interpolate(frame, [FILL_START, FILL_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  const points = getPolygonPoints(
    spec.values.map((v) => v * progress), CHART_RADIUS,
  );
  const fillAlpha =
    HIGHLIGHT.baseFillAlpha +
    (HIGHLIGHT.emphasisFillAlpha - HIGHLIGHT.baseFillAlpha) * emphasis;

  return (
    <polygon
      points={points}
      fill={`rgba(${spec.fillRGB},${fillAlpha})`}
      stroke={spec.strokeColor}
      strokeWidth={2.5 + HIGHLIGHT.emphasisStrokeBonus * emphasis}
      strokeLinejoin="round"
      opacity={opacity}
      style={{
        filter:
          emphasis > 0.01
            ? `drop-shadow(0 0 ${HIGHLIGHT.glowRadius * emphasis}px ${spec.strokeColor})`
            : undefined,
      }}
    />
  );
};

/** 顶点圆点：fill 后段 spring 弹出；高值 = 金色大点 + 扩散光环；随所属方高亮状态压暗 */
const RadarDot: React.FC<{ spec: ChartSpec; side: CharSide; index: number }> = ({
  spec, side, index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { opacity } = highlightStateAt(frame, side);

  const value = spec.values[index];
  const isHighValue = value >= ANIMATION.highValueThreshold;
  const pos = getOctagonPoint(index, (value / 100) * CHART_RADIUS);

  const dotAppearFrame = FILL_START + ANIMATION.fillDuration * 0.7 + index * 2;
  const baseScale = spring({
    fps,
    frame: frame - dotAppearFrame,
    config: { damping: 200 },
    durationInFrames: 20,
  });
  if (baseScale < 0.01) return null;

  const highValueScale = isHighValue
    ? spring({
        fps,
        frame: frame - (dotAppearFrame + ANIMATION.fillDuration * 0.3 + index * 3),
        config: { damping: ANIMATION.highValueSpringDamping, mass: 0.8 },
        durationInFrames: 40,
      })
    : 0;
  const radius = isHighValue ? 6 + highValueScale * 6 : 6;

  const glowAppearFrame = FILL_START + ANIMATION.fillDuration * 0.8 + index * 3;
  const glowSpring = spring({
    fps,
    frame: frame - glowAppearFrame,
    config: { damping: ANIMATION.highValueSpringDamping, mass: 0.8 },
    durationInFrames: 40,
  });
  const glowOpacity = interpolate(glowSpring, [0, 0.3, 0.7, 1], [0, 0.8, 0.4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showGlow =
    isHighValue && ANIMATION.highValueGlowEnabled && frame >= glowAppearFrame && glowOpacity > 0.01;

  return (
    <g opacity={opacity}>
      {showGlow && (
        <circle
          cx={pos.x} cy={pos.y}
          r={6 + glowSpring * 40}
          fill="none"
          stroke={THEME.glowColor}
          strokeWidth={2}
          opacity={glowOpacity}
        />
      )}
      <circle
        cx={pos.x} cy={pos.y}
        r={radius * baseScale}
        fill={isHighValue ? THEME.highValueDotColor : spec.dotColor}
      />
    </g>
  );
};

/**
 * 属性名 + 双方评级行（左评级 / 右评级，配色按数值 tier 走，与系统一致；
 * 归属靠「/」左右位置 + 高亮压暗联动区分），随 labelStagger 逐个淡入上浮
 */
const VertexLabels: React.FC = () => {
  const frame = useCurrentFrame();
  const stateL = highlightStateAt(frame, "left");
  const stateR = highlightStateAt(frame, "right");
  const haloWidth = (size: number) => Math.max(4, size * 0.18);

  return (
    <g>
      {ATTRIBUTE_LABELS.map((label, i) => {
        const anchor = getLabelAnchor(i);

        const attrAppear = LABEL_START + i * ANIMATION.labelStagger;
        const attrOpacity = interpolate(frame, [attrAppear, attrAppear + 10], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: APPEAR_EASING,
        });
        const attrRise = interpolate(frame, [attrAppear, attrAppear + 10], [10, 0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: APPEAR_EASING,
        });

        const ratingAppear = attrAppear + 5;
        const ratingOpacity = interpolate(frame, [ratingAppear, ratingAppear + 10], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: APPEAR_EASING,
        });
        const ratingRise = interpolate(frame, [ratingAppear, ratingAppear + 10], [10, 0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: APPEAR_EASING,
        });

        const ratingProps = {
          y: anchor.y + anchor.yOffset + ratingRise,
          dominantBaseline: "central",
          fontSize: FONT.ratingLabel,
          fontWeight: "bold",
          fontFamily: FONT_FAMILY,
          paintOrder: "stroke",
          stroke: THEME.backgroundColor,
          strokeWidth: haloWidth(FONT.ratingLabel),
          strokeLinejoin: "round",
        } as const;

        return (
          <g key={i}>
            <text
              x={anchor.x}
              y={anchor.y + attrRise}
              textAnchor="middle"
              dominantBaseline="central"
              fill={THEME.labelColor}
              fontSize={FONT.attributeLabel}
              fontWeight="bold"
              fontFamily={FONT_FAMILY}
              opacity={attrOpacity}
              paintOrder="stroke"
              stroke={THEME.backgroundColor}
              strokeWidth={haloWidth(FONT.attributeLabel)}
              strokeLinejoin="round"
            >
              {label}
            </text>
            <text
              {...ratingProps}
              x={anchor.x - 10}
              textAnchor="end"
              fill={getRatingColor(calculateRating(LEFT_CHART.values[i]))}
              opacity={ratingOpacity * stateL.opacity}
            >
              {calculateRating(LEFT_CHART.values[i]).full}
            </text>
            <text
              {...ratingProps}
              x={anchor.x}
              textAnchor="middle"
              fill="rgba(148,163,184,0.6)"
              opacity={ratingOpacity}
            >
              /
            </text>
            <text
              {...ratingProps}
              x={anchor.x + 10}
              textAnchor="start"
              fill={getRatingColor(calculateRating(RIGHT_CHART.values[i]))}
              opacity={ratingOpacity * stateR.opacity}
            >
              {calculateRating(RIGHT_CHART.values[i]).full}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/**
 * 强弱三角箭头（几何与系统 DualRatingLabel 的 DiffBadge 同构）：
 * ▲更强（enhanceColor）/ ▼更弱（weakenColor），|差值| > doubleThreshold 时双三角。
 * 左方箭头在评级行左侧、右方在右侧；随 arrowVisibilityAt 弹出/常驻
 */
const ArrowTriangles: React.FC<{
  cx: number; cy: number; isUp: boolean; isBig: boolean; color: string;
}> = ({ cx, cy, isUp, isBig, color }) => {
  const size = ARROWS.size;
  const halfW = size * 0.5;
  const halfH = size * 0.55;
  const triangle = (centerX: number) => {
    const tipY = isUp ? cy - halfH : cy + halfH;
    const baseY = isUp ? cy + halfH : cy - halfH;
    return `M ${centerX - halfW} ${baseY} L ${centerX + halfW} ${baseY} L ${centerX} ${tipY} Z`;
  };
  const gap = size * 0.2;
  const sideOffset = (size + gap) / 2;
  return isBig ? (
    <>
      <path d={triangle(cx - sideOffset)} fill={color} />
      <path d={triangle(cx + sideOffset)} fill={color} />
    </>
  ) : (
    <path d={triangle(cx)} fill={color} />
  );
};

const StrengthArrows: React.FC = () => {
  const frame = useCurrentFrame();
  const sides: [ChartSpec, ChartSpec, CharSide][] = [
    [LEFT_CHART, RIGHT_CHART, "left"],
    [RIGHT_CHART, LEFT_CHART, "right"],
  ];
  return (
    <g>
      {sides.map(([own, other, side]) => {
        const visibility = arrowVisibilityAt(frame, side);
        if (visibility < 0.01) return null;
        return own.values.map((v, i) => {
          const diff = v - other.values[i];
          if (diff === 0) return null;
          const anchor = getLabelAnchor(i);
          const x =
            anchor.x + (side === "left" ? -ARROWS.sideOffset : ARROWS.sideOffset);
          const y = anchor.y + anchor.yOffset + ARROWS.offsetY;
          return (
            <g
              key={`${side}-${i}`}
              opacity={visibility}
              transform={`translate(${x} ${y}) scale(${visibility}) translate(${-x} ${-y})`}
            >
              <ArrowTriangles
                cx={x}
                cy={y}
                isUp={diff > 0}
                isBig={Math.abs(diff) > ARROWS.doubleThreshold}
                color={diff > 0 ? ARROWS.enhanceColor : ARROWS.weakenColor}
              />
            </g>
          );
        });
      })}
    </g>
  );
};

/** 整个叠加雷达图（grid + 双方 fill/dots + 标签）；高亮的一方动态置于顶层 */
const ChartPane: React.FC = () => {
  const frame = useCurrentFrame();
  const emphL = highlightStateAt(frame, "left").emphasis;
  const emphR = highlightStateAt(frame, "right").emphasis;

  const charts: [ChartSpec, CharSide][] = [
    [LEFT_CHART, "left"],
    [RIGHT_CHART, "right"],
  ];
  // 高亮方绘制在上层，保证加粗描边与光晕不被对方遮挡
  if (emphL > emphR) charts.reverse();

  return (
    <svg
      viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    >
      <RadarGrid />
      {charts.map(([spec, side]) => (
        <RadarFill key={side} spec={spec} side={side} />
      ))}
      {charts.map(([spec, side]) =>
        spec.values.map((_, i) => (
          <RadarDot key={`${side}-${i}`} spec={spec} side={side} index={i} />
        )),
      )}
      <VertexLabels />
      {ARROWS.show && <StrengthArrows />}
    </svg>
  );
};

// ─── 角色剪影头像 + slug（与系统 Silhouette / slug 同构） ───

/** 内嵌 SVG 剪影占位图（头 + 肩），正式集成时替换为真实 silhouetteSrc */
const silhouetteDataUri = (tint: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240"><g fill="${tint}"><circle cx="100" cy="62" r="44"/><path d="M100 114 C 58 114 28 146 22 196 L 20 240 L 180 240 L 178 196 C 172 146 142 114 100 114 Z"/></g></svg>`,
  )}`;

/** 半屏剪影：左方占左半屏、右方占右半屏（容器/尺寸规则与系统 Silhouette 一致） */
const CharSilhouette: React.FC<{ spec: ChartSpec; side: CharSide }> = ({ spec, side }) => {
  const frame = useCurrentFrame();
  const { emphasis, opacity } = highlightStateAt(frame, side);

  const fadeIn = interpolate(frame, [0, SILHOUETTE.fadeInFrames], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: APPEAR_EASING,
  });
  const appearScale = interpolate(frame, [0, SILHOUETTE.fadeInFrames], [0.95, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: APPEAR_EASING,
  });
  if (fadeIn < 0.01) return null;

  // 高亮 → emphasisOpacity；被压暗 → dimOpacity；常态 → baseOpacity
  const dimT = (1 - opacity) / (1 - HIGHLIGHT.dimOpacity);
  const own =
    SILHOUETTE.baseOpacity +
    (SILHOUETTE.emphasisOpacity - SILHOUETTE.baseOpacity) * emphasis;
  const effective = own * (1 - dimT) + SILHOUETTE.dimOpacity * dimT;
  const scale = appearScale * (1 + (SILHOUETTE.emphasisScale - 1) * emphasis);

  return (
    <div
      style={{
        position: "absolute",
        left: side === "left" ? 0 : "50%",
        top: 0,
        width: "50%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        paddingTop: "5%",
        opacity: fadeIn * effective,
        transform: `translateY(${SILHOUETTE.offsetY}px) scale(${scale})`,
        pointerEvents: "none",
      }}
    >
      <Img
        src={silhouetteDataUri(spec.silhouetteTint)}
        style={{ maxHeight: "55%", maxWidth: "80%", objectFit: "contain" }}
      />
    </div>
  );
};

/** slug 小字：左方左上角（系统位置）、右方镜像右上角；与角色名同步淡入/压暗 */
const ChartSlug: React.FC<{ spec: ChartSpec; side: CharSide }> = ({ spec, side }) => {
  const frame = useCurrentFrame();
  const { emphasis, opacity } = highlightStateAt(frame, side);
  const appearFrame =
    FILL_START + ANIMATION.fillDuration * NAMES.appearRatio + SLUG.fadeOffsetFrames;

  const appearOpacity = interpolate(
    frame, [appearFrame, appearFrame + NAMES.fadeInFrames], [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: APPEAR_EASING },
  );
  const dimmed =
    1 - ((1 - opacity) / (1 - HIGHLIGHT.dimOpacity)) * (1 - HIGHLIGHT.nameDimOpacity);

  return (
    <div
      style={{
        position: "absolute",
        top: SLUG.edgeOffset,
        ...(side === "left"
          ? { left: SLUG.edgeOffset }
          : { right: SLUG.edgeOffset }),
        opacity: appearOpacity * dimmed,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          color: SLUG.color,
          fontSize: SLUG.fontSize,
          fontWeight: "bold",
          fontFamily: FONT_FAMILY,
          letterSpacing: "0.05em",
          whiteSpace: "pre-line",
          display: "inline-block",
          textAlign: side === "left" ? "left" : "right",
          textShadow:
            emphasis > 0.01 ? `0 0 ${20 * emphasis}px ${spec.strokeColor}` : undefined,
        }}
      >
        {spec.slug}
      </span>
    </div>
  );
};

/** 左右两侧角色名：带主题色圆点，随 fill 进度淡入；高亮时放大提亮，被压暗时降透明度 */
const ChartName: React.FC<{ spec: ChartSpec; side: CharSide }> = ({ spec, side }) => {
  const frame = useCurrentFrame();
  const { emphasis, opacity } = highlightStateAt(frame, side);
  const appearFrame = FILL_START + ANIMATION.fillDuration * NAMES.appearRatio;

  const appearOpacity = interpolate(
    frame, [appearFrame, appearFrame + NAMES.fadeInFrames], [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: APPEAR_EASING },
  );
  const rise = interpolate(
    frame, [appearFrame, appearFrame + NAMES.fadeInFrames], [24, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: APPEAR_EASING },
  );

  // 名字被压暗时保持比多边形更高的可读度（dimOpacity → nameDimOpacity 重映射）
  const dimmed =
    1 - ((1 - opacity) / (1 - HIGHLIGHT.dimOpacity)) * (1 - HIGHLIGHT.nameDimOpacity);
  const scale = 1 + (HIGHLIGHT.nameEmphasisScale - 1) * emphasis;
  const cx = side === "left" ? MID_X - NAMES.sideOffset : MID_X + NAMES.sideOffset;

  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: LAYOUT.centerY,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 18,
        opacity: appearOpacity * dimmed,
        transform: `translate(-50%, -50%) translateY(${rise}px) scale(${scale})`,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          width: NAMES.fontSize * 0.36,
          height: NAMES.fontSize * 0.36,
          borderRadius: "50%",
          background: spec.strokeColor,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          color: THEME.labelColor,
          fontSize: NAMES.fontSize,
          fontWeight: "bold",
          fontFamily: FONT_FAMILY,
          letterSpacing: "0.1em",
          textShadow: `0 0 ${30 + 30 * emphasis}px ${spec.strokeColor}`,
          whiteSpace: "pre-line",
        }}
      >
        {spec.name}
      </span>
    </div>
  );
};

// ─── 主合成 ───

const ComparisonPreview: React.FC = () => (
  <AbsoluteFill>
    <Sequence>
      <Background />
    </Sequence>

    {SILHOUETTE.show && (
      <Sequence>
        <CharSilhouette spec={LEFT_CHART} side="left" />
        <CharSilhouette spec={RIGHT_CHART} side="right" />
      </Sequence>
    )}

    <Sequence>
      <ChartPane />
    </Sequence>

    {NAMES.show && (
      <Sequence>
        <ChartName spec={LEFT_CHART} side="left" />
        <ChartName spec={RIGHT_CHART} side="right" />
      </Sequence>
    )}

    {SLUG.show && (
      <Sequence>
        <ChartSlug spec={LEFT_CHART} side="left" />
        <ChartSlug spec={RIGHT_CHART} side="right" />
      </Sequence>
    )}
  </AbsoluteFill>
);

const Root: React.FC = () => (
  <Composition
    id="ComparisonPreview"
    component={ComparisonPreview}
    durationInFrames={TOTAL_DURATION}
    fps={VIDEO.fps}
    width={VIDEO.width}
    height={VIDEO.height}
  />
);

registerRoot(Root);
