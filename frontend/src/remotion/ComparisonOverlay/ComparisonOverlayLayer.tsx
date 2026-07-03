import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { BackgroundGradient } from "../Effects/BackgroundGradient";
import { BackgroundAudio } from "../Effects/BackgroundAudio";
import { BackgroundMedia } from "../Effects/BackgroundMedia";
import { Vignette } from "../Effects/Vignette";
import { selectBackgroundKind } from "../Effects/selectBackgroundKind";
import { Silhouette } from "../CharacterSilhouette/Silhouette";
import { RadarGrid } from "../RadarChart/RadarGrid";
import { OverlayFill } from "./OverlayFill";
import { OverlayVertexLabels } from "./OverlayVertexLabels";
import { StrengthArrows } from "./StrengthArrows";
import {
  dimProgress,
  highlightStateAt,
  remapDim,
  type OverlaySide,
} from "./highlight";
import type {
  ComparisonArrowStyle,
  ComparisonPairConfig,
  OverlayHighlightConfig,
  RadarVideoProps,
} from "../../types/radar";
import type { OverlayPhases } from "../../types/constants";
import {
  RADAR_MAX_RADIUS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  computeOverlayPhases,
  computePhaseStarts,
  defaultOverlayHighlightConfig,
} from "../../types/constants";
import { loadSelectedFonts } from "../../lib/fonts";

// ────────────────────────────────────────────────────────────────
// 叠加高亮布局的组件级常量（预览审定稿定值，未纳入 schema 的细节参数）。
// 叠加图为单个居中雷达图，按设计忽略每页的 radarCX/CY、剪影偏移、
// characterNameAlign 与右页 animation 时序（节奏一律取左页）。
// ────────────────────────────────────────────────────────────────
/** 单图缩放，1 = 系统 340px 最大半径 */
const CHART_SCALE = 0.95;
const CENTER_X = VIDEO_WIDTH / 2;
const CENTER_Y = 500;
const MAX_RADIUS = RADAR_MAX_RADIUS * CHART_SCALE;
/** 侧边角色名 */
const NAME_FONT_SIZE = 56;
/** 角色名 y：置于画面下方，对齐普通模式 RadarVideo（paddingBottom 120 + flex-end）的视觉 */
const NAME_BOTTOM_Y = VIDEO_HEIGHT - 120 - NAME_FONT_SIZE / 2;
const NAME_DIM_OPACITY = 0.3;
const NAME_EMPHASIS_SCALE = 1.12;
/** 剪影 */
const SILHOUETTE_FADE_IN_FRAMES = 25;
const SILHOUETTE_OFFSET_Y = -40;
/** 剪影向屏幕外缘推进（左剪影向左、右剪影向右），默认比半屏居中更靠边 */
const SILHOUETTE_EDGE_OFFSET = 180;
const SILHOUETTE_EMPHASIS_SCALE = 1.06;
/** slug 距画面左/右、上边缘的距离 */
const SLUG_EDGE_OFFSET = 80;

const APPEAR_EASING = Easing.bezier(0.16, 1, 0.3, 1);

const formatText = (text: string) => text.replace(/\\n/g, "\n");

type PageSideProps = {
  page: RadarVideoProps;
  side: OverlaySide;
  overlay: OverlayHighlightConfig;
  phases: OverlayPhases;
  /** 名字/slug 的出现帧（按左页节奏统一计算） */
  nameAppearFrame: number;
  nameFadeFrames: number;
};

/** 左右两侧角色名：带主题色圆点；高亮时放大提亮，被压暗时降透明度（保持可读） */
const SideName: React.FC<PageSideProps> = ({
  page,
  side,
  overlay,
  phases,
  nameAppearFrame,
  nameFadeFrames,
}) => {
  const frame = useCurrentFrame();
  const { emphasis, opacity } = highlightStateAt(frame, side, phases, overlay);

  const appearOpacity = interpolate(
    frame,
    [nameAppearFrame, nameAppearFrame + nameFadeFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: APPEAR_EASING },
  );
  const rise = interpolate(
    frame,
    [nameAppearFrame, nameAppearFrame + nameFadeFrames],
    [24, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: APPEAR_EASING },
  );

  const dimmed = remapDim(opacity, overlay.dimOpacity, NAME_DIM_OPACITY);
  const scale = 1 + (NAME_EMPHASIS_SCALE - 1) * emphasis;
  const centerX =
    side === "left"
      ? CENTER_X - overlay.nameSideOffset
      : CENTER_X + overlay.nameSideOffset;

  return (
    <div
      style={{
        position: "absolute",
        left: centerX,
        top: NAME_BOTTOM_Y,
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
          width: NAME_FONT_SIZE * 0.36,
          height: NAME_FONT_SIZE * 0.36,
          borderRadius: "50%",
          background: page.theme.gridStrokeColor,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          color: page.theme.labelColor,
          fontSize: NAME_FONT_SIZE,
          fontWeight: "bold",
          fontFamily: page.font.characterNameFamily,
          letterSpacing: "0.1em",
          textShadow: `0 0 ${30 + 30 * emphasis}px ${page.theme.gridStrokeColor}`,
          whiteSpace: "pre-line",
        }}
      >
        {formatText(page.characterName)}
      </span>
    </div>
  );
};

/** 双方 slug：左方左上角（系统位置）、右方镜像右上角；与角色名同步淡入/压暗 */
const SideSlug: React.FC<PageSideProps> = ({
  page,
  side,
  overlay,
  phases,
  nameAppearFrame,
  nameFadeFrames,
}) => {
  const frame = useCurrentFrame();
  const { emphasis, opacity } = highlightStateAt(frame, side, phases, overlay);
  if (!page.slug?.text) return null;

  const appearFrame = nameAppearFrame + (page.slug.fadeOffsetFrames ?? 0);
  const appearOpacity = interpolate(
    frame,
    [appearFrame, appearFrame + nameFadeFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: APPEAR_EASING },
  );
  const dimmed = remapDim(opacity, overlay.dimOpacity, NAME_DIM_OPACITY);

  return (
    <div
      style={{
        position: "absolute",
        top: SLUG_EDGE_OFFSET,
        ...(side === "left"
          ? { left: SLUG_EDGE_OFFSET }
          : { right: SLUG_EDGE_OFFSET }),
        opacity: appearOpacity * dimmed,
        transform: `translate(${page.slug.offsetX}px, ${page.slug.offsetY}px)`,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          color: page.slug.color,
          fontSize: page.slug.fontSize,
          fontFamily: page.slug.fontFamily || page.font.characterNameFamily,
          fontWeight: "bold",
          letterSpacing: "0.05em",
          whiteSpace: "pre-line",
          display: "inline-block",
          textAlign: side === "left" ? "left" : "right",
          textShadow:
            emphasis > 0.01
              ? `0 0 ${20 * emphasis}px ${page.theme.gridStrokeColor}`
              : undefined,
        }}
      >
        {formatText(page.slug.text)}
      </span>
    </div>
  );
};

type ComparisonOverlayLayerProps = {
  left: RadarVideoProps;
  right: RadarVideoProps;
  config: ComparisonPairConfig;
  arrowStyle: ComparisonArrowStyle;
};

/**
 * 叠加高亮（overlay）对比：同一雷达图叠加双八边形，双方同时绘制，
 * 依次高亮（另一方压暗）并弹出强弱箭头，最后恢复常态、箭头常驻。
 * RadarVideo 的兄弟顶层组件，由 MultiPageVideo 按 layout 分发。
 */
export const ComparisonOverlayLayer: React.FC<ComparisonOverlayLayerProps> = ({
  left,
  right,
  config,
  arrowStyle,
}) => {
  const frame = useCurrentFrame();
  const overlay = config.overlay ?? defaultOverlayHighlightConfig;
  // 双方共用左页 animation 节奏（右页 animation 时序按设计忽略）
  const animation = left.animation;
  const phases = computeOverlayPhases(animation, overlay);
  const phaseStarts = computePhaseStarts(animation);

  // 字体预载必须覆盖双页（含 slug 字体），否则服务端渲染会闪回退字体
  const fontDeps = [
    ...[left, right].flatMap((page) => [
      page.font.characterNameFamily,
      page.font.attributeLabelFamily,
      page.font.ratingLabelFamily,
      page.font.valuePopupFamily,
      ...(page.slug?.fontFamily ? [page.slug.fontFamily] : []),
    ]),
  ];
  const fontDepsKey = fontDeps.join("|");
  const [fontHandle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    loadSelectedFonts(fontDeps)
      .then(() => continueRender(fontHandle))
      .catch((err) => cancelRender(err));
  }, [fontDepsKey, fontHandle]);

  const nameAppearFrame =
    phaseStarts.fillStart + animation.fillDuration * animation.nameAppearRatio;
  const nameFadeFrames = animation.nameFadeInDuration;

  const stateL = highlightStateAt(frame, "left", phases, overlay);
  const stateR = highlightStateAt(frame, "right", phases, overlay);

  // 剪影透明度：常态 base → 高亮 emphasis → 被压暗 dim（由本层算好传 opacity）
  const silhouetteOpacity = (state: { emphasis: number; opacity: number }) => {
    const dimT = dimProgress(state.opacity, overlay.dimOpacity);
    const own =
      overlay.silhouetteBaseOpacity +
      (overlay.silhouetteEmphasisOpacity - overlay.silhouetteBaseOpacity) *
        state.emphasis;
    return own * (1 - dimT) + overlay.silhouetteDimOpacity * dimT;
  };

  const chartSides: Array<{ page: RadarVideoProps; side: OverlaySide }> = [
    { page: left, side: "left" },
    { page: right, side: "right" },
  ];
  // 高亮方绘制在上层，保证加粗描边与光晕不被对方遮挡
  const orderedCharts =
    stateL.emphasis > stateR.emphasis ? [...chartSides].reverse() : chartSides;

  const commonSideProps: Omit<PageSideProps, "page" | "side"> = {
    overlay,
    phases,
    nameAppearFrame,
    nameFadeFrames,
  };

  return (
    <AbsoluteFill>
      {/* 背景复用左页 background/theme 与 RadarVideo 相同的选择栈 */}
      <Sequence>
        {selectBackgroundKind(left.background) === "gradient" ? (
          <BackgroundGradient theme={left.theme} />
        ) : (
          <>
            <BackgroundMedia
              type={left.background.type as "image" | "video"}
              media={left.background.media!}
            />
            <Vignette theme={left.theme} />
            {left.background.type === "video" && (
              <BackgroundAudio media={left.background.media!} />
            )}
          </>
        )}
      </Sequence>

      {/* 双方剪影：左右半屏各一；高亮明暗在本层算好经 opacity 传入 */}
      <Sequence>
        {chartSides.map(({ page, side }) => (
          <Silhouette
            key={side}
            src={page.silhouetteSrc}
            opacity={silhouetteOpacity(side === "left" ? stateL : stateR)}
            delay={0}
            fadeInDuration={SILHOUETTE_FADE_IN_FRAMES}
            offsetX={
              side === "left" ? -SILHOUETTE_EDGE_OFFSET : SILHOUETTE_EDGE_OFFSET
            }
            offsetY={SILHOUETTE_OFFSET_Y}
            scaleMultiplier={
              page.layout.silhouetteScale *
              (1 +
                (SILHOUETTE_EMPHASIS_SCALE - 1) *
                  (side === "left" ? stateL.emphasis : stateR.emphasis))
            }
            side={side}
          />
        ))}
      </Sequence>

      {/* 单 svg 图表面板：网格 + 双方多边形/圆点 + 顶点标签 + 强弱箭头 */}
      <Sequence>
        <svg
          viewBox={`0 0 ${VIDEO_WIDTH} ${VIDEO_HEIGHT}`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        >
          <RadarGrid
            cx={CENTER_X}
            cy={CENTER_Y}
            gridRingCount={left.layout.gridRingCount}
            gridColor={left.theme.gridColor}
            gridStrokeWidth={left.layout.gridStrokeWidth}
            radarScale={CHART_SCALE}
          />
          {orderedCharts.map(({ page, side }) => (
            <OverlayFill
              key={side}
              values={page.attributes.map((a) => a.value)}
              side={side}
              theme={page.theme}
              animation={animation}
              phaseStarts={phaseStarts}
              phases={phases}
              overlay={overlay}
              cx={CENTER_X}
              cy={CENTER_Y}
              maxRadius={MAX_RADIUS}
            />
          ))}
          <OverlayVertexLabels
            leftAttributes={left.attributes}
            rightAttributes={right.attributes}
            theme={left.theme}
            font={left.font}
            animation={animation}
            phaseStarts={phaseStarts}
            phases={phases}
            overlay={overlay}
            cx={CENTER_X}
            cy={CENTER_Y}
            maxRadius={MAX_RADIUS}
          />
          <StrengthArrows
            leftAttributes={left.attributes}
            rightAttributes={right.attributes}
            phases={phases}
            overlay={overlay}
            arrowStyle={arrowStyle}
            cx={CENTER_X}
            cy={CENTER_Y}
            maxRadius={MAX_RADIUS}
          />
        </svg>
      </Sequence>

      <Sequence>
        <SideName page={left} side="left" {...commonSideProps} />
        <SideName page={right} side="right" {...commonSideProps} />
      </Sequence>

      <Sequence>
        <SideSlug page={left} side="left" {...commonSideProps} />
        <SideSlug page={right} side="right" {...commonSideProps} />
      </Sequence>
    </AbsoluteFill>
  );
};
