/**
 * 【一次性单文件 Remotion 预览 · issue #17 左右对比（Side-by-Side）动画设计审核用】
 *
 * 本文件完全独立，不依赖 frontend/src 内任何代码，自带 registerRoot 入口，
 * 可直接渲染完整视频：
 *
 *   cd frontend
 *   pnpm exec remotion render preview/side-by-side-preview.tsx SideBySidePreview out/side-by-side-preview.mp4
 *
 * 也可在 Studio 中交互式调参预览：
 *
 *   pnpm exec remotion studio preview/side-by-side-preview.tsx
 *
 * 所有可调参数集中在下方「手动配置区」，直接改常量即可。
 * 动画设计审核通过后，将按此设计正式融入现有系统（ComparisonPairConfig 扩展 +
 * SideBySideLayer 组件 + Zod schema + UI 编辑器），届时删除本文件。
 */
import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
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

/** 布局：gap 为两图外接圆内缘之间的水平间距，图心 X 由 gap + 缩放自动推导 */
const LAYOUT = {
  gap: 280,
  /** 单图缩放，1 = 原系统的 340px 最大半径 */
  chartScale: 0.62,
  centerY: 490,
  gridRingCount: 4,
  gridStrokeWidth: 1.5,
};

/** 对应 issue #17 中未来的 sideBySideOptions */
const OPTIONS = {
  /** true = 两图同步播放；false = 右图延迟 staggerFrames 帧后播放 */
  syncAnimation: true,
  staggerFrames: 25,
  /** outside = 常规外置；inside = 标签收进图内；auto = 外置但不越过中线（碰撞避让） */
  labelPosition: "auto" as "outside" | "inside" | "auto",
  /** auto 模式：标签锚点距中线的最小安全距离 */
  autoMidlineMargin: 120,
  /** inside 模式：标签放在最大半径的比例位置 */
  insideLabelRatio: 0.52,
};

/** 图下方标题（带各自主题色圆点） */
const NAMES = {
  show: true,
  fontSize: 60,
  /** 相对雷达外环底部的下移距离（需避开底部顶点的标签 + 差值徽标） */
  offsetY: 175,
  fadeInFrames: 20,
  /** 名字出现时机 = fillStart + fillDuration * appearRatio */
  appearRatio: 0.7,
};

/** 中央 VS 分隔线：开场即出现，先于两图铺开，确立分屏语境 */
const DIVIDER = {
  show: true,
  text: "VS",
  fontSize: 72,
  color: "#94a3b8",
  lineColor: "rgba(148,163,184,0.35)",
  /** 分隔线上下两段各自的长度 */
  lineHalfLength: 210,
  /** VS 文字与分隔线之间留白 */
  textGap: 70,
  appearFrame: 8,
  appearDuration: 15,
};

/** 双图完成后，右图各顶点显示差值徽标（右值 - 左值，▲增强 / ▼减弱） */
const DIFF = {
  show: true,
  fontSize: 30,
  enhanceColor: "#ef4444",
  weakenColor: "#22c55e",
  /** 相对（较晚一图的）fill 完成后的出现延迟帧数 */
  delayAfterFill: 12,
  /** 逐属性错开帧数 */
  stagger: 3,
  /** 相对该顶点评级文字的下移距离 */
  offsetY: 34,
  /** 差值为 0 是否也显示 */
  showZero: false,
};

/** 动画节奏（与现有系统 computePhaseStarts 同构） */
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
const HOLD_EXTRA = 45;

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

const LEFT_CHART = {
  name: "觉醒前",
  values: [70, 55, 85, 50, 62, 78, 40, 60],
  fillColor: "rgba(99,102,241,0.28)",
  strokeColor: "rgba(129,140,248,0.95)",
  dotColor: "#818cf8",
};

const RIGHT_CHART = {
  name: "觉醒后",
  values: [88, 74, 90, 68, 60, 92, 55, 81],
  fillColor: "rgba(236,72,153,0.28)",
  strokeColor: "rgba(244,114,182,0.95)",
  dotColor: "#f472b6",
};

// ================================================================
// 以下为实现，审核动画时一般不需要动
// ================================================================

type ChartSpec = typeof LEFT_CHART;
type ChartSide = "left" | "right";

// ─── 几何（与 frontend/src/lib/math.ts 同构） ───

const NUM_SIDES = 8;
const BASE_MAX_RADIUS = 340;
const CHART_RADIUS = BASE_MAX_RADIUS * LAYOUT.chartScale;
const MID_X = VIDEO.width / 2;
const LEFT_CX = MID_X - LAYOUT.gap / 2 - CHART_RADIUS;
const RIGHT_CX = MID_X + LAYOUT.gap / 2 + CHART_RADIUS;

const getOctagonPoint = (index: number, radius: number, cx: number, cy: number) => {
  const angle = (2 * Math.PI * index) / NUM_SIDES - Math.PI / 2;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
};

const getPolygonPoints = (values: number[], maxRadius: number, cx: number, cy: number): string =>
  values
    .map((v, i) => {
      const { x, y } = getOctagonPoint(i, (v / 100) * maxRadius, cx, cy);
      return `${x},${y}`;
    })
    .join(" ");

/** 属性标签锚点（与 getRadarLabelAnchor 同构） */
const getLabelAnchor = (index: number, cx: number, cy: number) => {
  const distance =
    CHART_RADIUS + 30 + Math.max(FONT.attributeLabel, FONT.ratingLabel) * 0.8;
  const { x, y } = getOctagonPoint(index, distance, cx, cy);
  const yOffset = (FONT.attributeLabel + FONT.ratingLabel) * 0.5 + 6;
  return { x, y, yOffset };
};

/**
 * labelPosition 三模式统一转成 per-attribute 偏移量：
 * - inside：把标签从默认外置锚点拉到半径 insideLabelRatio 处
 * - auto：外置，但锚点越过中线安全区时沿 X 轴钳回（简化版碰撞避让）
 */
const labelAdjustment = (index: number, cx: number, side: ChartSide) => {
  const anchor = getLabelAnchor(index, cx, LAYOUT.centerY);
  if (OPTIONS.labelPosition === "inside") {
    const target = getOctagonPoint(
      index, CHART_RADIUS * OPTIONS.insideLabelRatio, cx, LAYOUT.centerY,
    );
    return { dx: target.x - anchor.x, dy: target.y - anchor.y };
  }
  if (OPTIONS.labelPosition === "auto") {
    const margin = OPTIONS.autoMidlineMargin;
    if (side === "left" && anchor.x > MID_X - margin) {
      return { dx: MID_X - margin - anchor.x, dy: 0 };
    }
    if (side === "right" && anchor.x < MID_X + margin) {
      return { dx: MID_X + margin - anchor.x, dy: 0 };
    }
  }
  return { dx: 0, dy: 0 };
};

// ─── 评级换算（与 frontend/src/lib/rating.ts 同构） ───

const RATING_TIERS: [number, string][] = [
  [200, "X"], [95, "SSS"], [90, "SS"], [85, "S"], [75, "A"],
  [60, "B"], [45, "C"], [30, "D"], [15, "E"], [0, "F"],
];
const RATING_MODIFIERS = ["--", "-", "", "+", "++"] as const;
const RATING_COLORS: Record<string, string> = {
  X: "#e040fb", SSS: "#ff6b6b", SS: "#ff8c42", S: "#ffa94d", A: "#ffd43b",
  B: "#69db7c", C: "#38d9a9", D: "#4dabf7", E: "#9775fa", F: "#868e96",
};

const calculateRating = (value: number): { base: string; full: string } => {
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

// ─── 动画阶段（与 computePhaseStarts 同构） ───

const LABEL_START = 10 + ANIMATION.labelStartOffset;
const LABEL_END = LABEL_START + ANIMATION.labelStagger * 8;
const FILL_START = LABEL_END + ANIMATION.fillStartOffset;
const FILL_END = FILL_START + ANIMATION.fillDuration;

/** 单图动画长度（不含尾部停留） */
const SINGLE_CHART_DURATION = FILL_END + 30;
const RIGHT_START = OPTIONS.syncAnimation ? 0 : OPTIONS.staggerFrames;
const DIFF_START = RIGHT_START + FILL_END + DIFF.delayAfterFill;
const TOTAL_DURATION = RIGHT_START + SINGLE_CHART_DURATION + HOLD_EXTRA;

const APPEAR_EASING = Easing.bezier(0.16, 1, 0.3, 1);

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

const RadarGrid: React.FC<{ cx: number }> = ({ cx }) => {
  const rings = Array.from({ length: LAYOUT.gridRingCount }, (_, i) => {
    const level = (i + 1) / LAYOUT.gridRingCount;
    return getPolygonPoints(
      Array(NUM_SIDES).fill(level * 100), CHART_RADIUS, cx, LAYOUT.centerY,
    );
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
        const end = getOctagonPoint(i, CHART_RADIUS, cx, LAYOUT.centerY);
        return (
          <line
            key={i}
            x1={cx} y1={LAYOUT.centerY} x2={end.x} y2={end.y}
            stroke={THEME.gridColor} strokeWidth={axisWidth}
          />
        );
      })}
    </g>
  );
};

const RadarFill: React.FC<{ cx: number; spec: ChartSpec }> = ({ cx, spec }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [FILL_START, FILL_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  const points = getPolygonPoints(
    spec.values.map((v) => v * progress), CHART_RADIUS, cx, LAYOUT.centerY,
  );
  return (
    <polygon
      points={points}
      fill={spec.fillColor}
      stroke={spec.strokeColor}
      strokeWidth={2.5}
      strokeLinejoin="round"
    />
  );
};

/** 顶点圆点：fill 后段 spring 弹出；高值 = 金色大点 + 扩散光环 */
const RadarDot: React.FC<{ cx: number; spec: ChartSpec; index: number }> = ({ cx, spec, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const value = spec.values[index];
  const isHighValue = value >= ANIMATION.highValueThreshold;
  const pos = getOctagonPoint(index, (value / 100) * CHART_RADIUS, cx, LAYOUT.centerY);

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
    <g>
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

/** 属性名 + 评级（S/A/B…）标签，随 labelStagger 逐个淡入上浮 */
const VertexLabels: React.FC<{ cx: number; spec: ChartSpec; side: ChartSide }> = ({ cx, spec, side }) => {
  const frame = useCurrentFrame();
  return (
    <g>
      {spec.values.map((value, i) => {
        const anchor = getLabelAnchor(i, cx, LAYOUT.centerY);
        const { dx, dy } = labelAdjustment(i, cx, side);
        const x = anchor.x + dx;

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

        const rating = calculateRating(value);
        const haloWidth = (size: number) => Math.max(4, size * 0.18);

        return (
          <g key={i}>
            <text
              x={x}
              y={anchor.y + attrRise + dy}
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
              {ATTRIBUTE_LABELS[i]}
            </text>
            <text
              x={x}
              y={anchor.y + anchor.yOffset + ratingRise + dy}
              textAnchor="middle"
              dominantBaseline="central"
              fill={RATING_COLORS[rating.base] ?? "#868e96"}
              fontSize={FONT.ratingLabel}
              fontWeight="bold"
              fontFamily={FONT_FAMILY}
              opacity={ratingOpacity}
              paintOrder="stroke"
              stroke={THEME.backgroundColor}
              strokeWidth={haloWidth(FONT.ratingLabel)}
              strokeLinejoin="round"
            >
              {rating.full}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/** 单侧雷达图（grid + fill + dots + labels），置于各自 Sequence 内以支持错峰播放 */
const ChartPane: React.FC<{ cx: number; spec: ChartSpec; side: ChartSide }> = ({ cx, spec, side }) => (
  <svg
    viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
  >
    <RadarGrid cx={cx} />
    <RadarFill cx={cx} spec={spec} />
    {spec.values.map((_, i) => (
      <RadarDot key={i} cx={cx} spec={spec} index={i} />
    ))}
    <VertexLabels cx={cx} spec={spec} side={side} />
  </svg>
);

/** 图下方角色名：带主题色圆点，随 fill 进度淡入（与单图模式的名字节奏一致） */
const ChartName: React.FC<{ cx: number; spec: ChartSpec }> = ({ cx, spec }) => {
  const frame = useCurrentFrame();
  const appearFrame = FILL_START + ANIMATION.fillDuration * NAMES.appearRatio;

  const opacity = interpolate(frame, [appearFrame, appearFrame + NAMES.fadeInFrames], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: APPEAR_EASING,
  });
  const rise = interpolate(frame, [appearFrame, appearFrame + NAMES.fadeInFrames], [24, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: APPEAR_EASING,
  });

  return (
    <div
      style={{
        position: "absolute",
        left: cx - CHART_RADIUS - 150,
        top: LAYOUT.centerY + CHART_RADIUS + NAMES.offsetY,
        width: (CHART_RADIUS + 150) * 2,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        opacity,
        transform: `translateY(${rise}px)`,
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
          textShadow: `0 0 30px ${spec.strokeColor}`,
          whiteSpace: "pre-line",
        }}
      >
        {spec.name}
      </span>
    </div>
  );
};

/** 中央分隔线 + VS 文字 */
const VsDivider: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [DIVIDER.appearFrame, DIVIDER.appearFrame + DIVIDER.appearDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: APPEAR_EASING },
  );
  const lineLen = DIVIDER.lineHalfLength * progress;
  return (
    <svg
      viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    >
      <line
        x1={MID_X} y1={LAYOUT.centerY - DIVIDER.textGap}
        x2={MID_X} y2={LAYOUT.centerY - DIVIDER.textGap - lineLen}
        stroke={DIVIDER.lineColor} strokeWidth={2} strokeLinecap="round"
      />
      <line
        x1={MID_X} y1={LAYOUT.centerY + DIVIDER.textGap}
        x2={MID_X} y2={LAYOUT.centerY + DIVIDER.textGap + lineLen}
        stroke={DIVIDER.lineColor} strokeWidth={2} strokeLinecap="round"
      />
      <text
        x={MID_X}
        y={LAYOUT.centerY}
        textAnchor="middle"
        dominantBaseline="central"
        fill={DIVIDER.color}
        fontSize={DIVIDER.fontSize}
        fontWeight="bold"
        fontStyle="italic"
        fontFamily={FONT_FAMILY}
        letterSpacing="0.05em"
        opacity={progress}
      >
        {DIVIDER.text}
      </text>
    </svg>
  );
};

/** 单个差值徽标：▲+n（增强）/ ▼-n（减弱），spring 弹出，逐属性错开 */
const DiffBadge: React.FC<{ index: number; diff: number }> = ({ index, diff }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appearFrame = index * DIFF.stagger;
  const scale = spring({
    fps,
    frame: frame - appearFrame,
    config: { damping: 200 },
    durationInFrames: 18,
  });
  if (scale < 0.01) return null;

  const anchor = getLabelAnchor(index, RIGHT_CX, LAYOUT.centerY);
  const { dx, dy } = labelAdjustment(index, RIGHT_CX, "right");
  const x = anchor.x + dx;
  const y = anchor.y + dy + anchor.yOffset + DIFF.offsetY;

  const enhance = diff > 0;
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fill={enhance ? DIFF.enhanceColor : DIFF.weakenColor}
      fontSize={DIFF.fontSize}
      fontWeight="bold"
      fontFamily={FONT_FAMILY}
      transform={`translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})`}
      paintOrder="stroke"
      stroke={THEME.backgroundColor}
      strokeWidth={Math.max(4, DIFF.fontSize * 0.18)}
      strokeLinejoin="round"
    >
      {`${enhance ? "▲+" : "▼"}${diff}`}
    </text>
  );
};

const DiffBadges: React.FC = () => (
  <svg
    viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
  >
    {RIGHT_CHART.values.map((v, i) => {
      const diff = v - LEFT_CHART.values[i];
      if (diff === 0 && !DIFF.showZero) return null;
      return <DiffBadge key={i} index={i} diff={diff} />;
    })}
  </svg>
);

// ─── 主合成 ───

const SideBySidePreview: React.FC = () => (
  <AbsoluteFill>
    <Sequence>
      <Background />
    </Sequence>

    {DIVIDER.show && (
      <Sequence>
        <VsDivider />
      </Sequence>
    )}

    {/* 左图 */}
    <Sequence>
      <ChartPane cx={LEFT_CX} spec={LEFT_CHART} side="left" />
      {NAMES.show && <ChartName cx={LEFT_CX} spec={LEFT_CHART} />}
    </Sequence>

    {/* 右图：syncAnimation=false 时整体延迟 staggerFrames */}
    <Sequence from={RIGHT_START}>
      <ChartPane cx={RIGHT_CX} spec={RIGHT_CHART} side="right" />
      {NAMES.show && <ChartName cx={RIGHT_CX} spec={RIGHT_CHART} />}
    </Sequence>

    {DIFF.show && (
      <Sequence from={DIFF_START}>
        <DiffBadges />
      </Sequence>
    )}
  </AbsoluteFill>
);

const Root: React.FC = () => (
  <Composition
    id="SideBySidePreview"
    component={SideBySidePreview}
    durationInFrames={TOTAL_DURATION}
    fps={VIDEO.fps}
    width={VIDEO.width}
    height={VIDEO.height}
  />
);

registerRoot(Root);
