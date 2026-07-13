"use client";

import React from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select";
import { isVideoPage, type PageConfig } from "../../types/radar";

type PreviewTargetSelectorProps = {
  pages: PageConfig[];
  previewMode: "single" | "multi";
  activePageIndex: number;
  onSelectGlobal: () => void;
  onSelectPage: (index: number) => void;
};

const GLOBAL_VALUE = "global";

/**
 * 预览对象说明 + 下拉切换：始终反映播放器当前真实预览的对象
 * （全局拼接视频 or 某一单页），避免"页签在单页、实际在放全局"的误解。
 */
export const PreviewTargetSelector: React.FC<PreviewTargetSelectorProps> = ({
  pages,
  previewMode,
  activePageIndex,
  onSelectGlobal,
  onSelectPage,
}) => {
  const value =
    previewMode === "multi" ? GLOBAL_VALUE : `page-${activePageIndex}`;

  const handleChange = (v: string | null) => {
    if (!v) return;
    if (v === GLOBAL_VALUE) {
      onSelectGlobal();
      return;
    }
    const index = Number(v.replace("page-", ""));
    if (!Number.isNaN(index)) onSelectPage(index);
  };

  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs text-muted-foreground shrink-0">预览对象</span>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="h-7 text-xs flex-1">
          <SelectValue placeholder="选择预览对象" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={GLOBAL_VALUE}>
            全局（{pages.length} 页完整视频）
          </SelectItem>
          {pages.map((page, i) => (
            <SelectItem key={i} value={`page-${i}`}>
              第{i + 1}页：{(isVideoPage(page) ? page.label : page.characterName) || `页${i + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
