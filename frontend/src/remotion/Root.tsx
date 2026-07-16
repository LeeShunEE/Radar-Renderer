import { Composition } from "remotion";
import {
  COMP_NAME,
  MULTI_COMP_NAME,
  calculateDuration,
  calculateMultiPageTotalFrames,
  defaultRadarProps,
  defaultMultiPageConfig,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "../types/constants";
import type { MultiPageConfig } from "../types/radar";
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
          return {
            durationInFrames: calculateMultiPageTotalFrames(cfg),
            props,
          };
        }}
      />
    </>
  );
};
