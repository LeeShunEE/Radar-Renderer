"use client";

import React from "react";
import { Label } from "../ui/label";
import { isVideoPage } from "../../types/radar";
import type { MultiPageConfig, VideoPageConfig } from "../../types/radar";
import { calculateVideoOverlapDuration, VIDEO_FPS } from "../../types/constants";

type VideoOverlapConfigPanelProps = {
  config: MultiPageConfig;
  onChange: (config: MultiPageConfig) => void;
};

/**
 * 视频重叠配对面板（镜像 comparisons 的相邻页配对惯用法，见计划 D8）。
 * 枚举相邻视频页对（pages[i] 与 pages[i+1] 均为视频页），每对可启用重叠；
 * 启用后配置 offsetFrames（第二视频延迟帧数）与 topLayer（谁在上层）。
 * 增删/移动页面后，已存 videoOverlaps 由 RadarEditor.remapIndexPairs 自动同步。
 */
export const VideoOverlapConfigPanel: React.FC<VideoOverlapConfigPanelProps> = ({
  config,
  onChange,
}) => {
  // 枚举相邻视频页对
  const pairs: Array<{ first: number; second: number }> = [];
  for (let i = 0; i < config.pages.length - 1; i++) {
    if (isVideoPage(config.pages[i]) && isVideoPage(config.pages[i + 1])) {
      pairs.push({ first: i, second: i + 1 });
    }
  }

  if (pairs.length === 0) {
    return (
      <div className="space-y-2 border border-unfocused-border-color rounded-lg p-4 bg-card">
        <h3 className="text-sm font-semibold text-foreground">视频重叠</h3>
        <p className="text-xs text-subtitle">需要两个相邻的视频页才能配置重叠</p>
      </div>
    );
  }

  const findOverlap = (first: number, second: number) =>
    config.videoOverlaps.find(
      (o) => o.firstPageIndex === first && o.secondPageIndex === second,
    );

  const toggleOverlap = (first: number, second: number) => {
    const existingIdx = config.videoOverlaps.findIndex(
      (o) => o.firstPageIndex === first && o.secondPageIndex === second,
    );
    if (existingIdx >= 0) {
      onChange({
        ...config,
        videoOverlaps: config.videoOverlaps.filter((_, i) => i !== existingIdx),
      });
    } else {
      onChange({
        ...config,
        videoOverlaps: [
          ...config.videoOverlaps,
          {
            firstPageIndex: first,
            secondPageIndex: second,
            offsetFrames: 0,
            topLayer: "second" as const,
          },
        ],
      });
    }
  };

  const updateOverlap = (
    first: number,
    patch: Partial<{ offsetFrames: number; topLayer: "first" | "second" }>,
  ) => {
    onChange({
      ...config,
      videoOverlaps: config.videoOverlaps.map((o) =>
        o.firstPageIndex === first ? { ...o, ...patch } : o,
      ),
    });
  };

  const nameOf = (idx: number) => {
    const p = config.pages[idx];
    return isVideoPage(p) ? p.label : `页${idx + 1}`;
  };

  return (
    <div className="space-y-4 border border-unfocused-border-color rounded-lg p-4 bg-card">
      <h3 className="text-sm font-semibold text-foreground">视频重叠</h3>
      <p className="text-[11px] text-subtitle">
        相邻两个视频页可重叠播放：第二个相对第一个延迟若干帧进入，可指定谁在上层（典型：上层绿幕人物叠在下层画面上）。
      </p>
      {pairs.map(({ first, second }) => {
        const ov = findOverlap(first, second);
        const active = !!ov;
        const firstPage = config.pages[first] as VideoPageConfig;
        const secondPage = config.pages[second] as VideoPageConfig;
        const totalFrames = ov
          ? calculateVideoOverlapDuration(
              firstPage.durationInFrames,
              secondPage.durationInFrames,
              ov,
            )
          : null;
        return (
          <div
            key={first}
            className="space-y-3 p-3 border border-unfocused-border-color rounded-md bg-muted/30"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-foreground">
                页{first + 1}（{nameOf(first)}）+ 页{second + 1}（{nameOf(second)}）
              </h4>
              <button
                type="button"
                onClick={() => toggleOverlap(first, second)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  active
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/50"
                    : "bg-muted/50 text-muted-foreground border border-unfocused-border-color hover:bg-muted"
                }`}
                title={active ? "取消重叠" : "启用重叠"}
              >
                ⚡重叠
              </button>
            </div>
            {active && ov && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-subtitle shrink-0">偏移帧数</Label>
                  <input
                    type="number"
                    min={0}
                    data-testid={`vp-overlap-offset-${first}`}
                    value={ov.offsetFrames}
                    onChange={(e) =>
                      updateOverlap(first, {
                        offsetFrames: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-20 h-6 px-1 text-xs text-center rounded border border-unfocused-border-color bg-background text-foreground"
                  />
                  <span className="text-[11px] text-subtitle">
                    ≈ {(ov.offsetFrames / VIDEO_FPS).toFixed(2)}s
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-subtitle shrink-0">上层</Label>
                  <select
                    aria-label="上层"
                    data-testid={`vp-overlap-top-${first}`}
                    value={ov.topLayer}
                    onChange={(e) =>
                      updateOverlap(first, {
                        topLayer: e.target.value as "first" | "second",
                      })
                    }
                    className="px-2 py-1 text-xs border border-unfocused-border-color rounded bg-background text-foreground"
                  >
                    <option value="second">第二个视频</option>
                    <option value="first">第一个视频</option>
                  </select>
                </div>
                {totalFrames !== null && (
                  <p className="text-[11px] text-subtitle">
                    重叠段：{totalFrames} 帧 / {(totalFrames / VIDEO_FPS).toFixed(1)} 秒
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
