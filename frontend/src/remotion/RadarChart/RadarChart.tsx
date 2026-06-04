import React from "react";
import type { AnimationConfig, FontConfig, RadarAttribute, RadarTheme } from "../../types/radar";
import { RadarGrid } from "./RadarGrid";
import { RadarFill } from "./RadarFill";
import { RadarDot } from "./RadarDot";
import { AttributeLabel } from "../Labels/AttributeLabel";
import { ValuePopup } from "../Labels/ValuePopup";
import { RatingLabel } from "../Labels/RatingLabel";

type RadarChartProps = {
  cx: number;
  cy: number;
  gridRingCount: number;
  gridStrokeWidth: number;
  attributes: RadarAttribute[];
  theme: RadarTheme;
  animation: AnimationConfig;
  font: FontConfig;
  attributeLabelOffsetX?: number;
  attributeLabelOffsetY?: number;
  ratingLabelOffsetX?: number;
  ratingLabelOffsetY?: number;
  radarScale?: number;
  ratingFadeOutAtFrame?: number;
  ratingFadeOutDuration?: number;
};

export const RadarChart: React.FC<RadarChartProps> = ({
  cx,
  cy,
  gridRingCount,
  gridStrokeWidth,
  attributes,
  theme,
  animation,
  font,
  attributeLabelOffsetX = 0,
  attributeLabelOffsetY = 0,
  ratingLabelOffsetX = 0,
  ratingLabelOffsetY = 0,
  radarScale = 1,
  ratingFadeOutAtFrame,
  ratingFadeOutDuration,
}) => {
  return (
    <svg
      viewBox="0 0 1920 1080"
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    >
      <RadarGrid
        cx={cx}
        cy={cy}
        gridRingCount={gridRingCount}
        gridColor={theme.gridColor}
        gridStrokeWidth={gridStrokeWidth}
        radarScale={radarScale}
      />
      <RadarFill
        cx={cx}
        cy={cy}
        attributes={attributes}
        theme={theme}
        animation={animation}
        radarScale={radarScale}
      />
      {attributes.map((attr, i) => (
        <React.Fragment key={i}>
          <RadarDot
            cx={cx}
            cy={cy}
            index={i}
            value={attr.value}
            isHighValue={attr.value >= animation.highValueThreshold}
            theme={theme}
            animation={animation}
          />
          <AttributeLabel
            cx={cx}
            cy={cy}
            labelOffsetX={(attr.labelOffsetX ?? 0) + attributeLabelOffsetX}
            labelOffsetY={(attr.labelOffsetY ?? 0) + attributeLabelOffsetY}
            index={i}
            label={attr.shortLabel}
            color={theme.labelColor}
            animation={animation}
            fontSize={font.attributeLabel}
            fontFamily={font.attributeLabelFamily}
            ratingLabelFontSize={font.ratingLabel}
            radarScale={radarScale}
            haloColor={theme.backgroundColor}
          />
          <RatingLabel
            cx={cx}
            cy={cy}
            labelOffsetX={(attr.labelOffsetX ?? 0) + ratingLabelOffsetX}
            labelOffsetY={(attr.labelOffsetY ?? 0) + ratingLabelOffsetY}
            index={i}
            value={attr.value}
            animation={animation}
            fontSize={font.ratingLabel}
            fontFamily={font.ratingLabelFamily}
            attributeLabelFontSize={font.attributeLabel}
            fadeOutAtFrame={ratingFadeOutAtFrame}
            fadeOutDuration={ratingFadeOutDuration}
            haloColor={theme.backgroundColor}
          />
          {attr.value >= animation.highValueThreshold && (
            <ValuePopup
              cx={cx}
              cy={cy}
              labelOffsetX={attr.labelOffsetX}
              labelOffsetY={attr.labelOffsetY}
              index={i}
              value={attr.value}
              color={theme.valueColor}
              animation={animation}
              fontSize={font.valuePopup}
              fontFamily={font.valuePopupFamily}
            />
          )}
        </React.Fragment>
      ))}
    </svg>
  );
};
