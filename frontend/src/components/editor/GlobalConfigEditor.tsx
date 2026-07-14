"use client";

import React from "react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { AssetSelector } from "../files/AssetSelector";
import { isVideoPage } from "../../types/radar";
import type { ComparisonPairConfig, MultiPageConfig, PageConfig } from "../../types/radar";
import { defaultComparisonConfig } from "../../types/constants";
import {
  calculateComparisonDuration,
  calculateMultiPageTotalFrames,
  calculatePageDuration,
  VIDEO_FPS,
} from "../../types/constants";
import { GlobalOverridePanel } from "./GlobalOverridePanel";
import { applyGlobalOverride } from "../../lib/global-override";

type GlobalConfigEditorProps = {
  config: MultiPageConfig;
  activePageIndex: number;
  onChange: (config: MultiPageConfig) => void;
  onSetActive: (index: number) => void;
  onAddPage: () => void;
  /** 添加视频页（Task 3.2 起在 UI 暴露按钮） */
  onAddVideoPage?: () => void;
  onDuplicatePage: (index: number) => void;
  onRemovePage: (index: number) => void;
  onMovePage: (from: number, to: number) => void;
  onPreviewAll: () => void;
};

export const GlobalConfigEditor: React.FC<GlobalConfigEditorProps> = ({
  config,
  activePageIndex,
  onChange,
  onSetActive,
  onAddPage,
  onAddVideoPage,
  onDuplicatePage,
  onRemovePage,
  onMovePage,
  onPreviewAll,
}) => {
  const totalPages = config.pages.length;

  // Check if a page is involved in any comparison
  const isPageCompared = (pageIndex: number): boolean => {
    return config.comparisons.some(
      (c) => c.firstPageIndex === pageIndex || c.secondPageIndex === pageIndex,
    );
  };

  // Check if two adjacent pages are in a comparison together
  const isComparisonActive = (firstIdx: number, secondIdx: number): boolean => {
    return config.comparisons.some(
      (c) => c.firstPageIndex === firstIdx && c.secondPageIndex === secondIdx,
    );
  };

  // Toggle comparison between two adjacent pages
  const toggleComparison = (firstIdx: number, secondIdx: number) => {
    const existingIdx = config.comparisons.findIndex(
      (c) => c.firstPageIndex === firstIdx && c.secondPageIndex === secondIdx,
    );

    if (existingIdx >= 0) {
      // Remove
      const comparisons = config.comparisons.filter((_, i) => i !== existingIdx);
      onChange({ ...config, comparisons });
    } else {
      // D2：配对仅在相邻双雷达页生效；视频页不参与对比（任一侧为视频页禁止新建）
      if (
        isVideoPage(config.pages[firstIdx]) ||
        isVideoPage(config.pages[secondIdx])
      )
        return;
      // Can't add if either page is already compared
      if (isPageCompared(firstIdx) || isPageCompared(secondIdx)) return;
      const newComp: ComparisonPairConfig = {
        ...defaultComparisonConfig,
        firstPageIndex: firstIdx,
        secondPageIndex: secondIdx,
      };
      onChange({ ...config, comparisons: [...config.comparisons, newComp] });
    }
  };

  const mergedPages = config.pages.map((p) =>
    isVideoPage(p) ? p : applyGlobalOverride(p, config.globalOverride),
  );

  const pageDisplayName = (page: PageConfig, i: number) =>
    (isVideoPage(page) ? page.label : page.characterName) || `页${i + 1}`;

  const totalFrames = calculateMultiPageTotalFrames(config);
  const totalSeconds = (totalFrames / VIDEO_FPS).toFixed(1);

  return (
    <>
    <div className="space-y-4 border border-unfocused-border-color rounded-lg p-4 bg-card">
      <h3 className="text-sm font-semibold text-foreground">全局配置</h3>

      {/* 页面标签列表 */}
      <div className="space-y-2">
        <Label className="text-xs text-subtitle">页面列表</Label>
        <div className="flex flex-wrap gap-1.5 items-center">
          {config.pages.map((page, i) => (
            <React.Fragment key={i}>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onSetActive(i)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    i === activePageIndex
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {i + 1}. {pageDisplayName(page, i)}
                </button>
                <button
                  type="button"
                  onClick={() => i > 0 && onMovePage(i, i - 1)}
                  disabled={i === 0}
                  className="px-1 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                  title="上移"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() =>
                    i < totalPages - 1 && onMovePage(i, i + 1)
                  }
                  disabled={i === totalPages - 1}
                  className="px-1 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                  title="下移"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicatePage(i)}
                  className="px-1 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  title="复制"
                >
                  ⧉
                </button>
                {totalPages > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemovePage(i)}
                    className="px-1 py-1.5 text-xs text-geist-error hover:text-geist-error/80"
                    title="删除"
                  >
                    ×
                  </button>
                )}
              </div>
              {/* Comparison toggle between adjacent pages */}
              {i < totalPages - 1 && totalPages > 1 && (
                <button
                  type="button"
                  onClick={() => toggleComparison(i, i + 1)}
                  disabled={
                    isVideoPage(page) ||
                    isVideoPage(config.pages[i + 1]) ||
                    (!isComparisonActive(i, i + 1) &&
                      (isPageCompared(i) || isPageCompared(i + 1)))
                  }
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    isComparisonActive(i, i + 1)
                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                      : "bg-muted/50 text-muted-foreground border border-unfocused-border-color hover:bg-muted"
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                  title={isComparisonActive(i, i + 1) ? "取消对比" : "对比渲染"}
                >
                  ⚡对比
                </button>
              )}
            </React.Fragment>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddPage}
            className="h-7 text-xs"
          >
            + 添加页面
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAddVideoPage?.()}
            className="h-7 text-xs"
          >
            + 添加视频页
          </Button>
        </div>
      </div>

      {/* 背景音乐选择 */}
      <AssetSelector
        category="music"
        value={config.musicUrl}
        onChange={(path) => onChange({ ...config, musicUrl: path })}
        showPlayButton
      />

      {/* 总时长统计 */}
      <div className="space-y-1.5">
        <Label className="text-xs text-subtitle">
          总时长：{totalFrames} 帧 / {totalSeconds} 秒（共 {totalPages} 页）
        </Label>
        <div className="text-xs text-subtitle space-y-0.5">
          {(() => {
            const compMap = new Map<number, (typeof config.comparisons)[number]>();
            for (const comp of config.comparisons) {
              compMap.set(comp.firstPageIndex, comp);
            }
            const compared = new Set<number>();
            const lines: React.ReactNode[] = [];
            for (let i = 0; i < config.pages.length; i++) {
              if (compared.has(i)) continue;
              const comp = compMap.get(i);
              const left = mergedPages[i];
              const right = i + 1 < mergedPages.length ? mergedPages[i + 1] : undefined;
              // 配对仅在相邻两页都是雷达页时生效（D2 守卫）
              if (comp && right && !isVideoPage(left) && !isVideoPage(right)) {
                const frames = calculateComparisonDuration(left, right, comp);
                const seconds = (frames / VIDEO_FPS).toFixed(1);
                lines.push(
                  <div key={i}>
                    对比：页{i + 1}（{pageDisplayName(config.pages[i], i)}）+ 页{i + 2}（{pageDisplayName(config.pages[i + 1], i + 1)}）：{frames} 帧 / {seconds} 秒
                  </div>
                );
                compared.add(i);
                compared.add(i + 1);
              } else {
                const frames = calculatePageDuration(left);
                const seconds = (frames / VIDEO_FPS).toFixed(1);
                lines.push(
                  <div key={i}>
                    页{i + 1}（{pageDisplayName(config.pages[i], i)}）：{frames} 帧 / {seconds} 秒
                  </div>
                );
              }
            }
            return lines;
          })()}
        </div>
      </div>

      {/* 全局预览按钮 */}
      {totalPages > 1 && (
        <div className="pt-2 space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPreviewAll}
            className="w-full h-8 text-xs"
          >
            ▶ 全局预览（{totalPages} 页拼接）
          </Button>

          <p className="text-xs text-subtitle">
            共 {totalFrames} 帧 / {totalSeconds} 秒
          </p>
        </div>
      )}
    </div>

    <GlobalOverridePanel config={config} onChange={onChange} />
    </>
  );
};
