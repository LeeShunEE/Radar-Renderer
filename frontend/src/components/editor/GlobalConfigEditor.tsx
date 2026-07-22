"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, Clock3, Music2, Play } from "lucide-react";
import { AssetSelector } from "../files/AssetSelector";
import { Button } from "../ui/button";
import type { ComparisonPairConfig, MultiPageConfig } from "../../types/radar";
import {
  calculateComparisonDuration,
  calculateDuration,
  defaultComparisonConfig,
  VIDEO_FPS,
} from "../../types/constants";
import { GlobalOverridePanel } from "./GlobalOverridePanel";
import { PageSequenceEditor } from "./PageSequenceEditor";
import { applyGlobalOverride } from "../../lib/global-override";

type GlobalConfigEditorProps = {
  config: MultiPageConfig;
  pageIds?: readonly string[];
  activePageIndex: number;
  onChange: (config: MultiPageConfig) => void;
  onSetActive: (index: number) => void;
  onAddPage: () => void;
  onDuplicatePage: (index: number) => void;
  onRemovePage: (index: number) => void;
  onReorderPageSequence: (activeId: string, overId: string) => void;
  onPreviewAll: () => void;
};

type DurationRow = {
  id: string;
  label: string;
  frames: number;
};

function selectedAssetName(path: string): string {
  if (!path) return "未选择音乐";
  const cleanPath = path.split(/[?#]/, 1)[0];
  const encodedName = cleanPath.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
  try {
    return decodeURIComponent(encodedName);
  } catch {
    return encodedName;
  }
}

function durationLabel(frames: number): string {
  return `${frames} 帧 · ${(frames / VIDEO_FPS).toFixed(1)} 秒`;
}

export const GlobalConfigEditor: React.FC<GlobalConfigEditorProps> = ({
  config,
  pageIds,
  activePageIndex,
  onChange,
  onSetActive,
  onAddPage,
  onDuplicatePage,
  onRemovePage,
  onReorderPageSequence,
  onPreviewAll,
}) => {
  const [musicExpanded, setMusicExpanded] = useState(false);
  const [durationExpanded, setDurationExpanded] = useState(false);

  const comparedPageIndices = useMemo(
    () =>
      new Set(
        config.comparisons.flatMap((comparison) => [
          comparison.firstPageIndex,
          comparison.secondPageIndex,
        ]),
      ),
    [config.comparisons],
  );

  const toggleComparison = (
    firstPageIndex: number,
    secondPageIndex: number,
  ) => {
    const existingComparisonIndex = config.comparisons.findIndex(
      (comparison) =>
        comparison.firstPageIndex === firstPageIndex &&
        comparison.secondPageIndex === secondPageIndex,
    );

    if (existingComparisonIndex >= 0) {
      onChange({
        ...config,
        comparisons: config.comparisons.filter(
          (_, index) => index !== existingComparisonIndex,
        ),
      });
      return;
    }

    if (
      comparedPageIndices.has(firstPageIndex) ||
      comparedPageIndices.has(secondPageIndex)
    ) {
      return;
    }

    const comparison: ComparisonPairConfig = {
      ...defaultComparisonConfig,
      firstPageIndex,
      secondPageIndex,
    };
    onChange({
      ...config,
      comparisons: [...config.comparisons, comparison],
    });
  };

  const { durationRows, totalFrames } = useMemo(() => {
    const mergedPages = config.pages.map((page) =>
      applyGlobalOverride(page, config.globalOverride),
    );
    const comparisonByFirstPage = new Map(
      config.comparisons.map((comparison) => [
        comparison.firstPageIndex,
        comparison,
      ]),
    );
    const consumedPages = new Set<number>();
    const rows: DurationRow[] = [];

    for (let pageIndex = 0; pageIndex < config.pages.length; pageIndex += 1) {
      if (consumedPages.has(pageIndex)) continue;

      const comparison = comparisonByFirstPage.get(pageIndex);
      const secondPage = comparison
        ? mergedPages[comparison.secondPageIndex]
        : undefined;
      if (comparison && secondPage) {
        const frames = calculateComparisonDuration(
          mergedPages[pageIndex],
          secondPage,
          comparison,
        );
        rows.push({
          id: `comparison-${pageIndex}-${comparison.secondPageIndex}`,
          label: `对比组 · 页 ${pageIndex + 1} ${config.pages[pageIndex].characterName} + 页 ${comparison.secondPageIndex + 1} ${config.pages[comparison.secondPageIndex].characterName}`,
          frames,
        });
        consumedPages.add(pageIndex);
        consumedPages.add(comparison.secondPageIndex);
        continue;
      }

      rows.push({
        id: `page-${pageIndex}`,
        label: `页 ${pageIndex + 1} · ${config.pages[pageIndex].characterName}`,
        frames: calculateDuration(mergedPages[pageIndex].animation),
      });
      consumedPages.add(pageIndex);
    }

    return {
      durationRows: rows,
      totalFrames: rows.reduce((sum, row) => sum + row.frames, 0),
    };
  }, [config.comparisons, config.globalOverride, config.pages]);

  return (
    <>
      <div className="space-y-4 rounded-lg border border-unfocused-border-color bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">全局配置</h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            编排页面顺序、统一媒体与输出节奏
          </p>
        </div>

        <PageSequenceEditor
          config={config}
          pageIds={pageIds}
          activePageIndex={activePageIndex}
          onSetActive={onSetActive}
          onAddPage={onAddPage}
          onDuplicatePage={onDuplicatePage}
          onRemovePage={onRemovePage}
          onReorderPageSequence={onReorderPageSequence}
          onToggleComparison={toggleComparison}
        />

        <section className="overflow-hidden rounded-lg border border-unfocused-border-color">
          <button
            type="button"
            aria-expanded={musicExpanded}
            aria-controls="global-music-selector"
            aria-label={`${musicExpanded ? "收起" : "展开"}背景音乐选择器`}
            onClick={() => setMusicExpanded((expanded) => !expanded)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="rounded-md bg-muted p-1.5 text-muted-foreground">
              <Music2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-foreground">
                背景音乐
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {selectedAssetName(config.musicUrl)}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${musicExpanded ? "rotate-180" : ""}`}
            />
          </button>
          {musicExpanded && (
            <div
              id="global-music-selector"
              className="border-t border-unfocused-border-color p-3"
            >
              <AssetSelector
                category="music"
                value={config.musicUrl}
                onChange={(path) => onChange({ ...config, musicUrl: path })}
                showPlayButton
                embedded
              />
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-lg border border-unfocused-border-color">
          <button
            type="button"
            aria-expanded={durationExpanded}
            aria-controls="global-duration-details"
            aria-label={`${durationExpanded ? "收起" : "展开"}时长明细`}
            onClick={() => setDurationExpanded((expanded) => !expanded)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="rounded-md bg-muted p-1.5 text-muted-foreground">
              <Clock3 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-foreground">
                总时长
              </span>
              <span className="block text-[10px] tabular-nums text-muted-foreground">
                {durationLabel(totalFrames)} · 共 {config.pages.length} 页
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${durationExpanded ? "rotate-180" : ""}`}
            />
          </button>
          {durationExpanded && (
            <div
              id="global-duration-details"
              className="space-y-1 border-t border-unfocused-border-color px-3 py-2.5"
            >
              {durationRows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground"
                >
                  <span className="min-w-0 truncate">{row.label}</span>
                  <span className="shrink-0 tabular-nums">
                    {durationLabel(row.frames)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {config.pages.length > 1 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPreviewAll}
            className="h-9 w-full justify-between text-xs"
          >
            <span className="flex items-center gap-2">
              <Play className="h-3.5 w-3.5" />
              全局预览（{config.pages.length} 页拼接）
            </span>
            <span className="font-normal tabular-nums text-muted-foreground">
              {durationLabel(totalFrames)}
            </span>
          </Button>
        )}
      </div>

      <GlobalOverridePanel config={config} onChange={onChange} />
    </>
  );
};
