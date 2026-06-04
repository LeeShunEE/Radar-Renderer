"use client";

import React from "react";
import { Button } from "../ui/button";
import type { RadarVideoProps, MultiPageConfig } from "../../types/radar";
import { calculateDuration, VIDEO_FPS } from "../../../types/constants";
import { useVideoRender } from "../../hooks/useVideoRender";

type ExportPanelProps = {
  props: RadarVideoProps;
  config: MultiPageConfig;
  mode: "single";
};

export const ExportPanel: React.FC<ExportPanelProps> = ({
  props,
  config,
  mode,
}) => {
  const { rendering, error, startRender } = useVideoRender();

  const totalPages = config.pages.length;
  const totalFrames = config.pages.reduce(
    (sum, p) => sum + calculateDuration(p.animation),
    0,
  );

  return (
    <div className="space-y-3 border border-unfocused-border-color rounded-lg p-4">
      <h3 className="text-sm font-semibold text-foreground">导出</h3>

      {/* 单页导出 */}
      <div className="space-y-2">
        <p className="text-xs text-subtitle">
          导出当前页：{props.characterName}
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => startRender("h264", "single", props, config)}
            disabled={rendering}
            className="flex-1"
            size="sm"
          >
            {rendering ? "渲染中..." : "导出当前页 MP4"}
          </Button>
          <Button
            onClick={() => startRender("gif", "single", props, config)}
            disabled={rendering}
            variant="outline"
            className="flex-1"
            size="sm"
          >
            {rendering ? "渲染中..." : "导出当前页 GIF"}
          </Button>
        </div>
      </div>

      {/* 全部导出 */}
      {totalPages > 1 && (
        <div className="space-y-2">
          <p className="text-xs text-subtitle">
            导出全部页面：{totalPages} 页，共 {totalFrames} 帧 /{" "}
            {(totalFrames / VIDEO_FPS).toFixed(1)} 秒
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => startRender("h264", "multi", props, config)}
              disabled={rendering}
              className="flex-1"
              size="sm"
              variant="secondary"
            >
              {rendering ? "渲染中..." : "导出全部 MP4"}
            </Button>
            <Button
              onClick={() => startRender("gif", "multi", props, config)}
              disabled={rendering}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              {rendering ? "渲染中..." : "导出全部 GIF"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-geist-error">{error}</p>}
    </div>
  );
};
