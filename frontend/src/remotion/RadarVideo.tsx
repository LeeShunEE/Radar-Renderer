import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BackgroundGradient } from "./Effects/BackgroundGradient";
import { BackgroundMedia } from "./Effects/BackgroundMedia";
import { Vignette } from "./Effects/Vignette";
import { selectBackgroundKind } from "./Effects/selectBackgroundKind";
import { Silhouette } from "./CharacterSilhouette/Silhouette";
import { RadarChart } from "./RadarChart/RadarChart";
import { HighValueGlow } from "./Effects/HighValueGlow";
import { ComparisonFill } from "./RadarChart/ComparisonFill";
import { DualRatingLabel } from "./Labels/DualRatingLabel";
import { Legend } from "./Labels/Legend";
import type { ComparisonArrowStyle, ComparisonPairConfig, RadarTheme, RadarVideoProps, ComparisonOverlayConfig } from "../types/radar";
import { RADAR_MAX_RADIUS, calculateDuration, computePhaseStarts } from "../types/constants";
import { getOctagonPoint } from "../lib/math";
import { loadSelectedFonts } from "../lib/fonts";

const formatCharacterName = (name: string) => name.replace(/\\n/g, "\n");

const alignToFlex = (align: "left" | "center" | "right" | undefined): "flex-start" | "center" | "flex-end" => {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
};

type ComparisonRadarDotProps = {
  cx: number;
  cy: number;
  index: number;
  value: number;
  leftValue: number;
  isHighValue: boolean;
  theme: RadarTheme;
  polygonMode: "expand" | "extend";
  fillDuration: number;
};

const ComparisonRadarDot: React.FC<ComparisonRadarDotProps> = ({
  cx, cy, index, value, leftValue, isHighValue, theme, polygonMode, fillDuration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = Math.min(Math.max(frame / fillDuration, 0), 1);
  const animatedValue = polygonMode === "expand"
    ? value * progress
    : leftValue + (value - leftValue) * progress;

  const normalizedValue = (animatedValue / 100) * RADAR_MAX_RADIUS;
  const pos = getOctagonPoint(index, normalizedValue, cx, cy);

  const dotAppearFrame = fillDuration * 0.7 + index * 2;

  const baseScale = spring({
    fps,
    frame: frame - dotAppearFrame,
    config: { damping: 200 },
    durationInFrames: 20,
  });

  const radius = isHighValue ? 8 : 6;
  if (baseScale < 0.01) return null;

  return (
    <circle
      cx={pos.x}
      cy={pos.y}
      r={radius * baseScale}
      fill={isHighValue ? theme.highValueDotColor : theme.dotColor}
    />
  );
};

type ComparisonLayerProps = {
  primary: RadarVideoProps;
  secondary: RadarVideoProps;
  config: ComparisonPairConfig;
  arrowStyle: ComparisonArrowStyle;
};

const ComparisonLayer: React.FC<ComparisonLayerProps> = ({ primary, secondary, config, arrowStyle }) => {
  const frame = useCurrentFrame();

  const cx = primary.layout.radarCX;
  const cy = primary.layout.radarCY;

  const silOffsetX = primary.layout.syncSilhouetteOffset
    ? primary.layout.characterNameOffsetX
    : primary.layout.silhouetteOffsetX;
  const silOffsetY = primary.layout.syncSilhouetteOffset
    ? primary.layout.characterNameOffsetY
    : primary.layout.silhouetteOffsetY;

  const swapDur = Math.max(1, config.swapDurationFrames);
  const halfSwap = Math.floor(swapDur / 2);
  // Name swap shares the swap window: B fades in during the second half.
  const secondaryTitleOpacity = interpolate(frame, [halfSwap, swapDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dualRatingAppear = secondary.animation.fillDuration * secondary.animation.nameAppearRatio;

  return (
    <AbsoluteFill>
      {/* B character silhouette: appear in the second half of the swap window. */}
      <Silhouette
        src={secondary.silhouetteSrc}
        opacity={secondary.theme.silhouetteOpacity}
        delay={halfSwap}
        fadeInDuration={swapDur - halfSwap}
        offsetX={silOffsetX + config.silhouetteSwapOffsetX}
        offsetY={silOffsetY + config.silhouetteSwapOffsetY}
        scaleMultiplier={secondary.layout.silhouetteScale}
      />

      {/* B character name */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "50%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          alignItems: alignToFlex(secondary.characterNameAlign),
          paddingBottom: 120,
          pointerEvents: "none",
          transform: `translate(${primary.layout.characterNameOffsetX}px, ${primary.layout.characterNameOffsetY}px)`,
        }}
      >
        <div style={{ opacity: secondaryTitleOpacity }}>
          <span
            style={{
              color: secondary.theme.labelColor,
              fontSize: secondary.font.characterName,
              fontWeight: "bold",
              fontFamily: secondary.font.characterNameFamily,
              letterSpacing: "0.1em",
              textShadow: `0 0 30px ${secondary.theme.glowColor}40`,
              whiteSpace: "pre-line",
              textAlign: secondary.characterNameAlign,
              display: "inline-block",
            }}
          >
            {formatCharacterName(secondary.characterName)}
          </span>
        </div>
      </div>

      {/* B slug */}
      {secondary.slug?.text ? (
        <div
          style={{
            position: "absolute",
            left: 80,
            top: 80,
            pointerEvents: "none",
            opacity: secondaryTitleOpacity,
            transform: `translate(${secondary.slug.offsetX}px, ${secondary.slug.offsetY}px)`,
          }}
        >
          <span
            style={{
              color: secondary.slug.color,
              fontSize: secondary.slug.fontSize,
              fontFamily: secondary.slug.fontFamily || secondary.font.characterNameFamily,
              fontWeight: "bold",
              letterSpacing: "0.05em",
              whiteSpace: "pre-line",
              display: "inline-block",
            }}
          >
            {formatCharacterName(secondary.slug.text)}
          </span>
        </div>
      ) : null}

      {/* B polygon + dots + dual ratings */}
      <svg
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      >
        <ComparisonFill
          cx={cx}
          cy={cy}
          leftAttributes={primary.attributes}
          rightAttributes={secondary.attributes}
          theme={secondary.theme}
          polygonMode={config.polygonMode}
          fillDuration={secondary.animation.fillDuration}
          radarScale={primary.layout.radarScale}
        />

        {secondary.attributes.map((attr, i) => (
          <ComparisonRadarDot
            key={i}
            cx={cx}
            cy={cy}
            index={i}
            value={attr.value}
            leftValue={primary.attributes[i].value}
            isHighValue={attr.value >= secondary.animation.highValueThreshold}
            theme={secondary.theme}
            polygonMode={config.polygonMode}
            fillDuration={secondary.animation.fillDuration}
          />
        ))}

        <DualRatingLabel
          cx={cx}
          cy={cy}
          left={primary}
          right={secondary}
          appearFrame={dualRatingAppear}
          slideFrames={config.dualRatingSlideFrames}
          fadeFrames={config.dualRatingFadeFrames}
          triangleScale={config.diffTriangleScale}
          arrowStyle={arrowStyle}
          haloColor={primary.theme.backgroundColor}
        />

        {config.showLegend && (
          <Legend
            left={primary}
            right={secondary}
            offsetX={config.legendOffsetX}
            offsetY={config.legendOffsetY}
            fontSize={config.legendFontSize}
            fontFamily={config.legendFontFamily}
            dotRadius={config.legendDotRadius}
          />
        )}
      </svg>
    </AbsoluteFill>
  );
};

type RadarVideoFullProps = RadarVideoProps & {
  comparison?: ComparisonOverlayConfig;
};

export const RadarVideo: React.FC<RadarVideoFullProps> = (props) => {
  const frame = useCurrentFrame();
  const { characterName, silhouetteSrc, attributes, theme, animation, font, layout, comparison, background } = props;

  const fontDeps = [
    font.characterNameFamily,
    font.attributeLabelFamily,
    font.ratingLabelFamily,
    font.valuePopupFamily,
    ...(props.slug?.fontFamily ? [props.slug.fontFamily] : []),
    ...(comparison ? [
      comparison.secondary.font.characterNameFamily,
      comparison.secondary.font.attributeLabelFamily,
      comparison.secondary.font.ratingLabelFamily,
      comparison.secondary.font.valuePopupFamily,
      ...(comparison.secondary.slug?.fontFamily ? [comparison.secondary.slug.fontFamily] : []),
      comparison.config.legendFontFamily,
    ] : []),
  ];

  const fontDepsKey = fontDeps.join("|");
  const [fontHandle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    loadSelectedFonts(fontDeps)
      .then(() => continueRender(fontHandle))
      .catch((err) => cancelRender(err));
    }, [fontDepsKey, fontHandle]);

  const cx = layout.radarCX;
  const cy = layout.radarCY;
  const silOffsetX = layout.syncSilhouetteOffset ? layout.characterNameOffsetX : layout.silhouetteOffsetX;
  const silOffsetY = layout.syncSilhouetteOffset ? layout.characterNameOffsetY : layout.silhouetteOffsetY;

  const fillStart = computePhaseStarts(animation).fillStart;
  const titleAppearFrame = fillStart + animation.fillDuration * animation.nameAppearRatio;
  const nameFadeFrames = animation.nameFadeInDuration;

  const titleOpacity = interpolate(
    frame,
    [titleAppearFrame, titleAppearFrame + nameFadeFrames],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );

  const titleY = interpolate(
    frame,
    [titleAppearFrame, titleAppearFrame + nameFadeFrames],
    [30, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );

  const comparisonStartFrame = comparison
    ? calculateDuration(animation) + comparison.config.delayFrames
    : 0;

  const ratingFadeOutAtFrame = comparison
    ? comparisonStartFrame + comparison.secondary.animation.fillDuration * comparison.secondary.animation.nameAppearRatio
    : undefined;

  // Primary title fades out in the first half of the configurable swap window.
  const primaryHalfSwap = comparison
    ? Math.floor(Math.max(1, comparison.config.swapDurationFrames) / 2)
    : 0;
  const primaryTitleFadeOpacity = comparison
    ? interpolate(frame, [comparisonStartFrame, comparisonStartFrame + primaryHalfSwap], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  return (
    <AbsoluteFill>
      <Sequence>
        {selectBackgroundKind(background) === "gradient" ? (
          <BackgroundGradient theme={theme} />
        ) : (
          <>
            <BackgroundMedia type={background.type as "image" | "video"} media={background.media!} />
            <Vignette theme={theme} />
          </>
        )}
      </Sequence>

      <Sequence from={animation.silhouetteDelay}>
        <Silhouette
          src={silhouetteSrc}
          opacity={theme.silhouetteOpacity}
          delay={0}
          fadeInDuration={animation.silhouetteFadeInDuration}
          offsetX={silOffsetX}
          offsetY={silOffsetY}
          scaleMultiplier={layout.silhouetteScale}
          fadeFromFrame={
            comparison
              ? comparisonStartFrame - animation.silhouetteDelay
              : undefined
          }
          fadeOutDuration={
            comparison ? primaryHalfSwap : undefined
          }
          targetOpacityOverride={
            comparison ? comparison.config.silhouetteFadeOutOpacity : undefined
          }
        />
      </Sequence>

      <Sequence>
        <RadarChart
          cx={cx}
          cy={cy}
          gridRingCount={layout.gridRingCount}
          gridStrokeWidth={layout.gridStrokeWidth}
          attributes={attributes}
          theme={theme}
          animation={animation}
          font={font}
          attributeLabelOffsetX={layout.attributeLabelOffsetX}
          attributeLabelOffsetY={layout.attributeLabelOffsetY}
          ratingLabelOffsetX={layout.ratingLabelOffsetX}
          ratingLabelOffsetY={layout.ratingLabelOffsetY}
          radarScale={layout.radarScale}
          ratingFadeOutAtFrame={ratingFadeOutAtFrame}
          ratingFadeOutDuration={comparison ? 1 : undefined}
        />
      </Sequence>

      {attributes.map(
        (attr, i) =>
          attr.value >= animation.highValueThreshold && (
            <Sequence key={`glow-${i}`} layout="none">
              <svg
                viewBox="0 0 1920 1080"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                }}
              >
                <HighValueGlow
                  cx={cx}
                  cy={cy}
                  index={i}
                  value={attr.value}
                  color={theme.glowColor}
                  damping={animation.highValueSpringDamping}
                  animation={animation}
                />
              </svg>
            </Sequence>
          ),
      )}

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "50%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          alignItems: alignToFlex(props.characterNameAlign),
          paddingBottom: 120,
          pointerEvents: "none",
          transform: `translate(${layout.characterNameOffsetX}px, ${layout.characterNameOffsetY}px)`,
        }}
      >
        <div
          style={{
            opacity: titleOpacity * primaryTitleFadeOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <span
            style={{
              color: theme.labelColor,
              fontSize: font.characterName,
              fontWeight: "bold",
              fontFamily: font.characterNameFamily,
              letterSpacing: "0.1em",
              textShadow: `0 0 30px ${theme.glowColor}40`,
              whiteSpace: "pre-line",
              textAlign: props.characterNameAlign,
              display: "inline-block",
            }}
          >
            {formatCharacterName(characterName)}
          </span>
        </div>
      </div>

      {props.slug?.text ? (() => {
        const slugStart = titleAppearFrame + (props.slug.fadeOffsetFrames ?? 0);
        const slugOpacity = interpolate(
          frame,
          [slugStart, slugStart + nameFadeFrames],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          },
        );
        return (
        <div
          style={{
            position: "absolute",
            left: 80,
            top: 80,
            pointerEvents: "none",
            opacity: slugOpacity * primaryTitleFadeOpacity,
            transform: `translate(${props.slug.offsetX}px, ${props.slug.offsetY}px)`,
          }}
        >
          <span
            style={{
              color: props.slug.color,
              fontSize: props.slug.fontSize,
              fontFamily: props.slug.fontFamily || font.characterNameFamily,
              fontWeight: "bold",
              letterSpacing: "0.05em",
              whiteSpace: "pre-line",
              display: "inline-block",
            }}
          >
            {formatCharacterName(props.slug.text)}
          </span>
        </div>
        );
      })() : null}

      {comparison && (
        <Sequence from={comparisonStartFrame}>
          <ComparisonLayer
            primary={props}
            secondary={comparison.secondary}
            config={comparison.config}
            arrowStyle={comparison.arrowStyle}
          />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
