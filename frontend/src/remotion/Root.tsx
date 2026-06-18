import { Composition } from "remotion";
import {
  COMP_NAME,
  MULTI_COMP_NAME,
  calculateDuration,
  calculateComparisonDuration,
  defaultRadarProps,
  defaultMultiPageConfig,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "../types/constants";
import type { MultiPageConfig, ComparisonPairConfig } from "../types/radar";
import { RadarVideo } from "./RadarVideo";
import { MultiPageVideo } from "./MultiPageVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={COMP_NAME}
        component={RadarVideo}
        durationInFrames={calculateDuration(defaultRadarProps.animation)}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={defaultRadarProps}
        calculateMetadata={async ({ props }) => {
          return {
            durationInFrames: calculateDuration(props.animation),
            props,
          };
        }}
      />
      <Composition
        id={MULTI_COMP_NAME}
        component={MultiPageVideo}
        durationInFrames={calculateDuration(defaultRadarProps.animation)}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{ config: defaultMultiPageConfig }}
        calculateMetadata={async ({ props }) => {
          const cfg = (props as { config: MultiPageConfig }).config;
          const compMap = new Map<number, ComparisonPairConfig>();
          for (const comp of cfg.comparisons ?? []) {
            compMap.set(comp.firstPageIndex, comp);
          }
          const compared = new Set<number>();
          let totalFrames = 0;
          for (let i = 0; i < cfg.pages.length; i++) {
            if (compared.has(i)) continue;
            const comp = compMap.get(i);
            if (comp && i + 1 < cfg.pages.length) {
              totalFrames += calculateComparisonDuration(cfg.pages[i], cfg.pages[i + 1], comp);
              compared.add(i);
              compared.add(i + 1);
            } else {
              totalFrames += calculateDuration(cfg.pages[i].animation);
            }
          }
          return {
            durationInFrames: totalFrames,
            props,
          };
        }}
      />
    </>
  );
};
