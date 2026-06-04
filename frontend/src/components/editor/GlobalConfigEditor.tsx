"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import type { ComparisonPairConfig, MultiPageConfig, RadarVideoProps } from "../../types/radar";
import { defaultComparisonConfig } from "../../../types/constants";
import {
  calculateDuration,
  calculateComparisonDuration,
  VIDEO_FPS,
} from "../../../types/constants";
import { useVideoRender } from "../../hooks/useVideoRender";
import { GlobalOverridePanel } from "./GlobalOverridePanel";
import { applyGlobalOverride } from "../../lib/global-override";

type GlobalConfigEditorProps = {
  config: MultiPageConfig;
  activePageIndex: number;
  currentPage: RadarVideoProps;
  onChange: (config: MultiPageConfig) => void;
  onSetActive: (index: number) => void;
  onAddPage: () => void;
  onDuplicatePage: (index: number) => void;
  onRemovePage: (index: number) => void;
  onMovePage: (from: number, to: number) => void;
  onPreviewAll: () => void;
};

export const GlobalConfigEditor: React.FC<GlobalConfigEditorProps> = ({
  config,
  activePageIndex,
  currentPage,
  onChange,
  onSetActive,
  onAddPage,
  onDuplicatePage,
  onRemovePage,
  onMovePage,
  onPreviewAll,
}) => {
  const { rendering, error, startRender } = useVideoRender();
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
    applyGlobalOverride(p, config.globalOverride),
  );

  const totalFrames = (() => {
    const compMap = new Map<number, (typeof config.comparisons)[number]>();
    for (const comp of config.comparisons) {
      compMap.set(comp.firstPageIndex, comp);
    }
    const compared = new Set<number>();
    let total = 0;
    for (let i = 0; i < config.pages.length; i++) {
      if (compared.has(i)) continue;
      const comp = compMap.get(i);
      if (comp && i + 1 < config.pages.length) {
        total += calculateComparisonDuration(mergedPages[i], mergedPages[i + 1], comp);
        compared.add(i);
        compared.add(i + 1);
      } else {
        total += calculateDuration(mergedPages[i].animation);
      }
    }
    return total;
  })();
  const totalSeconds = (totalFrames / VIDEO_FPS).toFixed(1);

  // 音乐文件列表
  const [musicFiles, setMusicFiles] = useState<
    { name: string; path: string }[]
  >([]);
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/music")
      .then((r) => r.json())
      .then(setMusicFiles);
  }, []);

  const togglePlay = (filePath: string) => {
    if (playingFile === filePath) {
      audioRef.current?.pause();
      setPlayingFile(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`/${filePath}`);
      audio.onended = () => setPlayingFile(null);
      audio.play();
      audioRef.current = audio;
      setPlayingFile(filePath);
    }
  };

  // 组件卸载时停止播放
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

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
                  {i + 1}. {page.characterName || `页${i + 1}`}
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
                  disabled={!isComparisonActive(i, i + 1) && (isPageCompared(i) || isPageCompared(i + 1))}
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
        </div>
      </div>

      {/* 背景音乐选择 */}
      <div className="space-y-1.5">
        <Label className="text-xs text-subtitle">背景音乐</Label>
        <div className="border border-unfocused-border-color rounded-md overflow-hidden">
          {musicFiles.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              请将音乐文件放入 public/music/ 目录
            </div>
          ) : (
            musicFiles.map((file) => {
              const isSelected = config.musicUrl === file.path;
              const isPlaying = playingFile === file.path;
              return (
                <div
                  key={file.path}
                  onClick={() =>
                    onChange({
                      ...config,
                      musicUrl: isSelected ? "" : file.path,
                    })
                  }
                  className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors border-l-2 ${
                    isSelected
                      ? "border-l-blue-500 bg-blue-500/10"
                      : "border-l-transparent hover:bg-muted/50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay(file.path);
                    }}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted text-xs shrink-0"
                  >
                    {isPlaying ? "⏸" : "▶"}
                  </button>
                  <span className="text-xs truncate flex-1">
                    {file.name}
                  </span>
                  {isSelected && (
                    <span className="text-xs text-blue-500 shrink-0">
                      选中
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
        {config.musicUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground"
            onClick={() => onChange({ ...config, musicUrl: "" })}
          >
            清除选择
          </Button>
        )}
      </div>

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
              if (comp && i + 1 < config.pages.length) {
                const frames = calculateComparisonDuration(mergedPages[i], mergedPages[i + 1], comp);
                const seconds = (frames / VIDEO_FPS).toFixed(1);
                lines.push(
                  <div key={i}>
                    对比：页{i + 1}（{config.pages[i].characterName}）+ 页{i + 2}（{config.pages[i + 1].characterName}）：{frames} 帧 / {seconds} 秒
                  </div>
                );
                compared.add(i);
                compared.add(i + 1);
              } else {
                const frames = calculateDuration(mergedPages[i].animation);
                const seconds = (frames / VIDEO_FPS).toFixed(1);
                lines.push(
                  <div key={i}>
                    页{i + 1}（{config.pages[i].characterName}）：{frames} 帧 / {seconds} 秒
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
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => startRender("h264", "multi", currentPage, config)}
              disabled={rendering}
              className="flex-1"
              size="sm"
              variant="secondary"
            >
              {rendering ? "渲染中..." : "导出全部 MP4"}
            </Button>
            <Button
              type="button"
              onClick={() => startRender("gif", "multi", currentPage, config)}
              disabled={rendering}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              {rendering ? "渲染中..." : "导出全部 GIF"}
            </Button>
          </div>
          {error && <p className="text-xs text-geist-error">{error}</p>}
        </div>
      )}
    </div>

    <GlobalOverridePanel config={config} onChange={onChange} />
    </>
  );
};
