import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { RadarVideo } from "./RadarVideo";
import { ComparisonOverlayLayer } from "./ComparisonOverlay/ComparisonOverlayLayer";
import { VideoPage } from "./VideoPage";
import { isVideoPage } from "../types/radar";
import type {
  ComparisonPairConfig,
  MultiPageConfig,
  RadarVideoProps,
  VideoOverlapPairConfig,
  VideoPageConfig,
} from "../types/radar";
import {
  calculateComparisonDuration,
  calculateDuration,
  calculateVideoOverlapDuration,
} from "../types/constants";
import { applyGlobalOverride } from "../lib/global-override";

type RenderItem =
  | { type: "single"; page: RadarVideoProps; duration: number }
  | { type: "video"; page: VideoPageConfig; duration: number }
  | {
      type: "videoOverlap";
      first: VideoPageConfig;
      second: VideoPageConfig;
      config: VideoOverlapPairConfig;
      duration: number;
    }
  | { type: "comparison"; left: RadarVideoProps; right: RadarVideoProps; config: ComparisonPairConfig; duration: number };

function buildRenderSequence(config: MultiPageConfig): RenderItem[] {
  const items: RenderItem[] = [];
  const consumed = new Set<number>();

  const compMap = new Map<number, ComparisonPairConfig>();
  for (const comp of config.comparisons) {
    compMap.set(comp.firstPageIndex, comp);
  }
  const overlapMap = new Map<number, VideoOverlapPairConfig>();
  for (const ov of config.videoOverlaps ?? []) {
    overlapMap.set(ov.firstPageIndex, ov);
  }

  // 全局覆写仅作用于雷达页
  const mergedPages = config.pages.map((p) =>
    isVideoPage(p) ? p : applyGlobalOverride(p, config.globalOverride),
  );

  for (let i = 0; i < config.pages.length; i++) {
    if (consumed.has(i)) continue;

    const cur = mergedPages[i];
    const next = i + 1 < mergedPages.length ? mergedPages[i + 1] : undefined;

    if (isVideoPage(cur)) {
      // 重叠配对仅在相邻两页都是视频页时生效（D8 守卫）
      const ov = overlapMap.get(i);
      if (ov && ov.secondPageIndex === i + 1 && next && isVideoPage(next)) {
        items.push({
          type: "videoOverlap",
          first: cur,
          second: next,
          config: ov,
          duration: calculateVideoOverlapDuration(cur.durationInFrames, next.durationInFrames, ov),
        });
        consumed.add(i);
        consumed.add(i + 1);
      } else {
        items.push({ type: "video", page: cur, duration: cur.durationInFrames });
      }
      continue;
    }

    // 雷达配对仅在相邻两页都是雷达页时生效（D2 守卫）
    const comp = compMap.get(i);
    if (comp && next && !isVideoPage(next)) {
      items.push({
        type: "comparison",
        left: cur,
        right: next,
        config: comp,
        duration: calculateComparisonDuration(cur, next, comp),
      });
      consumed.add(i);
      consumed.add(i + 1);
    } else {
      items.push({
        type: "single",
        page: cur,
        duration: calculateDuration(cur.animation),
      });
    }
  }

  return items;
}

function renderVideoOverlap(item: Extract<RenderItem, { type: "videoOverlap" }>) {
  const layers = [
    <Sequence key="first" durationInFrames={item.first.durationInFrames}>
      <VideoPage page={item.first} />
    </Sequence>,
    <Sequence
      key="second"
      from={item.config.offsetFrames}
      durationInFrames={item.second.durationInFrames}
    >
      <VideoPage page={item.second} />
    </Sequence>,
  ];
  // AbsoluteFill 按 DOM 顺序堆叠，后渲染者在上，无需 zIndex
  return item.config.topLayer === "first" ? [layers[1], layers[0]] : layers;
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
            ) : item.type === "video" ? (
              <VideoPage page={item.page} />
            ) : item.type === "videoOverlap" ? (
              renderVideoOverlap(item)
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
