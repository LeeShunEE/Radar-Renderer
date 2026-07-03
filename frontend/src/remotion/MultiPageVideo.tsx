import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { RadarVideo } from "./RadarVideo";
import { ComparisonOverlayLayer } from "./ComparisonOverlay/ComparisonOverlayLayer";
import type { ComparisonPairConfig, MultiPageConfig, RadarVideoProps } from "../types/radar";
import { calculateComparisonDuration, calculateDuration } from "../types/constants";
import { applyGlobalOverride } from "../lib/global-override";

type RenderItem =
  | { type: "single"; page: RadarVideoProps; duration: number }
  | { type: "comparison"; left: RadarVideoProps; right: RadarVideoProps; config: ComparisonPairConfig; duration: number };

function buildRenderSequence(config: MultiPageConfig): RenderItem[] {
  const items: RenderItem[] = [];
  const compared = new Set<number>();

  const compMap = new Map<number, ComparisonPairConfig>();
  for (const comp of config.comparisons) {
    compMap.set(comp.firstPageIndex, comp);
  }

  const mergedPages = config.pages.map((p) =>
    applyGlobalOverride(p, config.globalOverride),
  );

  for (let i = 0; i < config.pages.length; i++) {
    if (compared.has(i)) continue;

    const comp = compMap.get(i);
    if (comp && i + 1 < config.pages.length) {
      const left = mergedPages[i];
      const right = mergedPages[i + 1];
      items.push({
        type: "comparison",
        left,
        right,
        config: comp,
        duration: calculateComparisonDuration(left, right, comp),
      });
      compared.add(i);
      compared.add(i + 1);
    } else {
      const page = mergedPages[i];
      items.push({
        type: "single",
        page,
        duration: calculateDuration(page.animation),
      });
    }
  }

  return items;
}

export const MultiPageVideo: React.FC<{ config: MultiPageConfig }> = ({
  config,
}) => {
  const sequence = buildRenderSequence(config);
  let from = 0;

  const musicSrc = config.musicUrl
    ? config.musicUrl.startsWith("http") || config.musicUrl.startsWith("/")
      ? config.musicUrl
      : staticFile(config.musicUrl)
    : null;

  return (
    <AbsoluteFill>
      {musicSrc && <Audio src={musicSrc} />}
      {sequence.map((item, i) => {
        const startFrame = from;
        from += item.duration;
        return (
          <Sequence key={i} from={startFrame} durationInFrames={item.duration}>
            {item.type === "single" ? (
              <RadarVideo {...item.page} />
            ) : (item.config.layout ?? "transition") === "overlay" ? (
              // overlay：双方同图叠加高亮，走 RadarVideo 的兄弟顶层组件
              <ComparisonOverlayLayer
                left={item.left}
                right={item.right}
                config={item.config}
                arrowStyle={config.comparisonArrowStyle}
              />
            ) : (
              <RadarVideo
                {...item.left}
                comparison={{
                  secondary: item.right,
                  config: item.config,
                  arrowStyle: config.comparisonArrowStyle,
                }}
              />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
