"use client";

import React from "react";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Slider } from "../ui/slider";
import { Input } from "../ui/input";
import { FontSelect } from "./FontFamilyEditor";
import { ColorPicker } from "../ui/color-picker";
import { defaultOverlayHighlightConfig } from "../../types/constants";
import { isVideoPage } from "../../types/radar";
import type {
  ComparisonArrowStyle,
  ComparisonPairConfig,
  MultiPageConfig,
  OverlayHighlightConfig,
} from "../../types/radar";

type ComparisonConfigPanelProps = {
  config: MultiPageConfig;
  onChange: (config: MultiPageConfig) => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-subtitle">{label}</Label>
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value) || 0, min, max))}
          className="w-16 h-6 text-xs text-center"
        />
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

export const ComparisonConfigPanel: React.FC<ComparisonConfigPanelProps> = ({
  config,
  onChange,
}) => {
  if (config.comparisons.length === 0) return null;

  const updateComparison = (
    index: number,
    updates: Partial<ComparisonPairConfig>,
  ) => {
    const comparisons = [...config.comparisons];
    comparisons[index] = { ...comparisons[index], ...updates };
    onChange({ ...config, comparisons });
  };

  // overlay 嵌套字段更新：合并默认值兜底运行时旧配置缺失 overlay 的情况
  const updateOverlay = (
    index: number,
    updates: Partial<OverlayHighlightConfig>,
  ) => {
    const comparisons = [...config.comparisons];
    const cur = comparisons[index];
    comparisons[index] = {
      ...cur,
      overlay: { ...(cur.overlay ?? defaultOverlayHighlightConfig), ...updates },
    };
    onChange({ ...config, comparisons });
  };

  const arrowStyle = config.comparisonArrowStyle;
  const updateArrow = (updates: Partial<ComparisonArrowStyle>) =>
    onChange({
      ...config,
      comparisonArrowStyle: { ...arrowStyle, ...updates },
    });

  return (
    <div className="space-y-4 border border-unfocused-border-color rounded-lg p-4 bg-card">
      <h3 className="text-sm font-semibold text-foreground">对比配置</h3>

      <div className="space-y-3 p-3 border border-unfocused-border-color rounded-md bg-muted/30">
        <h4 className="text-xs font-medium text-foreground">
          对比箭头样式（所有对比共用）
        </h4>
        <p className="text-[11px] text-subtitle">
          提示：叠加高亮布局的强弱箭头复用下方的「增强色 / 减弱色」。
        </p>

        <div className="space-y-2">
          <div className="text-[11px] text-subtitle">➜ 方向箭头</div>
          <div className="grid grid-cols-2 gap-3">
            <SliderField
              label="字号"
              value={arrowStyle.arrowFontSize}
              min={8}
              max={200}
              onChange={(v) => updateArrow({ arrowFontSize: v })}
            />
            <div className="flex items-center gap-2">
              <Label className="text-xs text-subtitle shrink-0 w-12">颜色</Label>
              <ColorPicker
                value={arrowStyle.arrowColor}
                onChange={(v) => updateArrow({ arrowColor: v })}
              />
              <span className="text-xs text-subtitle font-mono truncate flex-1">
                {arrowStyle.arrowColor}
              </span>
            </div>
            <SliderField
              label="X 偏移"
              value={arrowStyle.arrowOffsetX}
              min={-200}
              max={200}
              onChange={(v) => updateArrow({ arrowOffsetX: v })}
            />
            <SliderField
              label="Y 偏移"
              value={arrowStyle.arrowOffsetY}
              min={-200}
              max={200}
              onChange={(v) => updateArrow({ arrowOffsetY: v })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] text-subtitle">上下差异三角</div>
          <div className="grid grid-cols-2 gap-3">
            <SliderField
              label="字号"
              value={arrowStyle.diffFontSize}
              min={8}
              max={200}
              onChange={(v) => updateArrow({ diffFontSize: v })}
            />
            <div /> {/* spacer */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-subtitle shrink-0 w-12">增强色</Label>
              <ColorPicker
                value={arrowStyle.diffEnhanceColor}
                onChange={(v) => updateArrow({ diffEnhanceColor: v })}
              />
              <span className="text-xs text-subtitle font-mono truncate flex-1">
                {arrowStyle.diffEnhanceColor}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-subtitle shrink-0 w-12">减弱色</Label>
              <ColorPicker
                value={arrowStyle.diffWeakenColor}
                onChange={(v) => updateArrow({ diffWeakenColor: v })}
              />
              <span className="text-xs text-subtitle font-mono truncate flex-1">
                {arrowStyle.diffWeakenColor}
              </span>
            </div>
            <SliderField
              label="X 偏移"
              value={arrowStyle.diffOffsetX}
              min={-200}
              max={200}
              onChange={(v) => updateArrow({ diffOffsetX: v })}
            />
            <SliderField
              label="Y 偏移"
              value={arrowStyle.diffOffsetY}
              min={-200}
              max={200}
              onChange={(v) => updateArrow({ diffOffsetY: v })}
            />
          </div>
        </div>
      </div>

      {config.comparisons.map((comp, i) => {
        const nameOf = (idx: number) => {
          const page = config.pages[idx];
          if (!page || isVideoPage(page)) return `页${idx + 1}`;
          return page.characterName || `页${idx + 1}`;
        };
        const leftName = nameOf(comp.firstPageIndex);
        const rightName = nameOf(comp.secondPageIndex);
        const update = (updates: Partial<ComparisonPairConfig>) =>
          updateComparison(i, updates);
        const layout = comp.layout ?? "transition";
        const ov = comp.overlay ?? defaultOverlayHighlightConfig;

        return (
          <div
            key={i}
            className="space-y-3 p-3 border border-unfocused-border-color rounded-md bg-muted/30"
          >
            <h4 className="text-xs font-medium text-foreground">
              页{comp.firstPageIndex + 1}（{leftName}）+ 页{comp.secondPageIndex + 1}（{rightName}）
            </h4>

            {/* 对比布局：切换过渡（A→B）/ 叠加高亮（同图双方） */}
            <div className="flex items-center justify-between">
              <Label className="text-xs text-subtitle">对比布局</Label>
              <div data-field-id={`comparison:${i}:layout`}>
                <select
                  aria-label="对比布局"
                  value={layout}
                  onChange={(e) =>
                    updateComparison(i, {
                      layout: e.target.value as "transition" | "overlay",
                    })
                  }
                  className="px-2 py-1 text-xs border border-unfocused-border-color rounded bg-background text-foreground"
                >
                  <option value="transition">切换过渡（A→B）</option>
                  <option value="overlay">叠加高亮（同图双方）</option>
                </select>
              </div>
            </div>

            {layout === "overlay" ? (
              <>
                {/* 叠加高亮：先高亮哪方 */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-subtitle">先高亮</Label>
                  <div data-field-id={`comparison:${i}:overlay.highlightOrder`}>
                    <select
                      aria-label="先高亮"
                      value={ov.highlightOrder}
                      onChange={(e) =>
                        updateOverlay(i, {
                          highlightOrder: e.target.value as "left-first" | "right-first",
                        })
                      }
                      className="px-2 py-1 text-xs border border-unfocused-border-color rounded bg-background text-foreground"
                    >
                      <option value="left-first">左方优先</option>
                      <option value="right-first">右方优先</option>
                    </select>
                  </div>
                </div>

                {/* 编排时序 */}
                <div className="grid grid-cols-2 gap-3">
                  <div data-field-id={`comparison:${i}:overlay.delayAfterFill`}>
                    <SliderField
                      label="落定→高亮延迟(帧)"
                      value={ov.delayAfterFill}
                      min={0}
                      max={120}
                      onChange={(v) => updateOverlay(i, { delayAfterFill: v })}
                    />
                  </div>
                  <div data-field-id={`comparison:${i}:overlay.transitionFrames`}>
                    <SliderField
                      label="高亮渐变(帧)"
                      value={ov.transitionFrames}
                      min={1}
                      max={60}
                      onChange={(v) => updateOverlay(i, { transitionFrames: v })}
                    />
                  </div>
                  <div data-field-id={`comparison:${i}:overlay.holdFrames`}>
                    <SliderField
                      label="每方停留(帧)"
                      value={ov.holdFrames}
                      min={0}
                      max={240}
                      onChange={(v) => updateOverlay(i, { holdFrames: v })}
                    />
                  </div>
                  <div data-field-id={`comparison:${i}:overlay.holdTailFrames`}>
                    <SliderField
                      label="尾部停留(帧)"
                      value={ov.holdTailFrames}
                      min={0}
                      max={600}
                      onChange={(v) => updateOverlay(i, { holdTailFrames: v })}
                    />
                  </div>
                </div>

                {/* 视觉强调 */}
                <div className="grid grid-cols-2 gap-3">
                  <div data-field-id={`comparison:${i}:overlay.dimOpacity`}>
                    <SliderField
                      label="压暗透明度"
                      value={ov.dimOpacity}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(v) => updateOverlay(i, { dimOpacity: v })}
                    />
                  </div>
                  <div data-field-id={`comparison:${i}:overlay.glowRadius`}>
                    <SliderField
                      label="高亮光晕半径"
                      value={ov.glowRadius}
                      min={0}
                      max={60}
                      onChange={(v) => updateOverlay(i, { glowRadius: v })}
                    />
                  </div>
                </div>

                {/* 强弱箭头 */}
                <div className="grid grid-cols-2 gap-3">
                  <div data-field-id={`comparison:${i}:overlay.arrowSize`}>
                    <SliderField
                      label="箭头尺寸"
                      value={ov.arrowSize}
                      min={8}
                      max={80}
                      onChange={(v) => updateOverlay(i, { arrowSize: v })}
                    />
                  </div>
                  <div data-field-id={`comparison:${i}:overlay.arrowSideOffset`}>
                    <SliderField
                      label="箭头距中线 X"
                      value={ov.arrowSideOffset}
                      min={0}
                      max={300}
                      onChange={(v) => updateOverlay(i, { arrowSideOffset: v })}
                    />
                  </div>
                  <div data-field-id={`comparison:${i}:overlay.arrowOffsetY`}>
                    <SliderField
                      label="箭头 Y 微调"
                      value={ov.arrowOffsetY}
                      min={-200}
                      max={200}
                      onChange={(v) => updateOverlay(i, { arrowOffsetY: v })}
                    />
                  </div>
                </div>

                {/* 角色名 / 剪影 */}
                <div className="grid grid-cols-2 gap-3">
                  <div data-field-id={`comparison:${i}:overlay.nameSideOffset`}>
                    <SliderField
                      label="侧名距中线"
                      value={ov.nameSideOffset}
                      min={100}
                      max={960}
                      onChange={(v) => updateOverlay(i, { nameSideOffset: v })}
                    />
                  </div>
                  <div data-field-id={`comparison:${i}:overlay.silhouetteBaseOpacity`}>
                    <SliderField
                      label="剪影常态透明度"
                      value={ov.silhouetteBaseOpacity}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(v) => updateOverlay(i, { silhouetteBaseOpacity: v })}
                    />
                  </div>
                  <div data-field-id={`comparison:${i}:overlay.silhouetteEmphasisOpacity`}>
                    <SliderField
                      label="剪影高亮透明度"
                      value={ov.silhouetteEmphasisOpacity}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(v) => updateOverlay(i, { silhouetteEmphasisOpacity: v })}
                    />
                  </div>
                  <div data-field-id={`comparison:${i}:overlay.silhouetteDimOpacity`}>
                    <SliderField
                      label="剪影压暗透明度"
                      value={ov.silhouetteDimOpacity}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(v) => updateOverlay(i, { silhouetteDimOpacity: v })}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* 延迟帧数 */}
                <div data-field-id={`comparison:${i}:delayFrames`}>
                  <SliderField
                    label="延迟帧数"
                    value={comp.delayFrames}
                    min={-120}
                    max={120}
                    onChange={(v) => update({ delayFrames: v })}
                  />
                </div>

                {/* 切换动画时长 */}
                <div data-field-id={`comparison:${i}:swapDurationFrames`}>
                  <SliderField
                    label="切换动画时长(帧)"
                    value={comp.swapDurationFrames}
                    min={1}
                    max={120}
                    onChange={(v) => update({ swapDurationFrames: v })}
                  />
                </div>

                {/* 第二多边形模式 */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-subtitle">第二多边形模式</Label>
                  <select
                    aria-label="第二多边形模式"
                    value={comp.polygonMode}
                    onChange={(e) =>
                      updateComparison(i, {
                        polygonMode: e.target.value as "expand" | "extend",
                      })
                    }
                    className="px-2 py-1 text-xs border border-unfocused-border-color rounded bg-background text-foreground"
                  >
                    <option value="expand">从中心展开</option>
                    <option value="extend">从A的值延伸</option>
                  </select>
                </div>

                {/* 显示图例 */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-subtitle">显示图例</Label>
                  <Switch
                    checked={comp.showLegend}
                    onCheckedChange={(checked: boolean) =>
                      updateComparison(i, { showLegend: checked })
                    }
                    size="sm"
                  />
                </div>

                {/* 头像错位偏移 X */}
                <div data-field-id={`comparison:${i}:silhouetteSwapOffset`}>
                  <SliderField
                    label="头像错位 X"
                    value={comp.silhouetteSwapOffsetX}
                    min={-500}
                    max={500}
                    onChange={(v) => update({ silhouetteSwapOffsetX: v })}
                  />
                  <SliderField
                    label="头像错位 Y"
                    value={comp.silhouetteSwapOffsetY}
                    min={-500}
                    max={500}
                    onChange={(v) => update({ silhouetteSwapOffsetY: v })}
                  />
                </div>

                {/* 第一角色淡出透明度 */}
                <div data-field-id={`comparison:${i}:silhouetteFadeOutOpacity`}>
                  <SliderField
                    label="A 角色淡出透明度"
                    value={comp.silhouetteFadeOutOpacity}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => update({ silhouetteFadeOutOpacity: v })}
                  />
                </div>

                {/* 差异三角缩放 */}
                <div data-field-id={`comparison:${i}:diffTriangleScale`}>
                  <SliderField
                    label="差异三角缩放"
                    value={comp.diffTriangleScale}
                    min={0.3}
                    max={3}
                    step={0.05}
                    onChange={(v) => update({ diffTriangleScale: v })}
                  />
                </div>

                {/* 评分滑动时长 */}
                <div data-field-id={`comparison:${i}:dualRatingSlideFrames`}>
                  <SliderField
                    label="评分滑动时长(帧)"
                    value={comp.dualRatingSlideFrames}
                    min={1}
                    max={60}
                    onChange={(v) => update({ dualRatingSlideFrames: v })}
                  />
                </div>

                {/* 评分淡入时长 */}
                <div data-field-id={`comparison:${i}:dualRatingFadeFrames`}>
                  <SliderField
                    label="评分淡入时长(帧)"
                    value={comp.dualRatingFadeFrames}
                    min={1}
                    max={60}
                    onChange={(v) => update({ dualRatingFadeFrames: v })}
                  />
                </div>

                {/* 图例字号 */}
                <div>
                  <SliderField
                    label="图例字号"
                    value={comp.legendFontSize}
                    min={12}
                    max={60}
                    onChange={(v) => update({ legendFontSize: v })}
                  />
                </div>

                {/* 图例圆点半径 */}
                <div data-field-id={`comparison:${i}:legendDotRadius`}>
                  <SliderField
                    label="图例圆点半径"
                    value={comp.legendDotRadius}
                    min={2}
                    max={30}
                    step={0.5}
                    onChange={(v) => update({ legendDotRadius: v })}
                  />
                </div>

                {/* 图例 XY 偏移 */}
                <div>
                  <SliderField
                    label="图例 X 偏移"
                    value={comp.legendOffsetX}
                    min={-500}
                    max={500}
                    onChange={(v) => update({ legendOffsetX: v })}
                  />
                  <SliderField
                    label="图例 Y 偏移"
                    value={comp.legendOffsetY}
                    min={-500}
                    max={500}
                    onChange={(v) => update({ legendOffsetY: v })}
                  />
                </div>

                {/* 图例字体 */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-subtitle shrink-0 w-20">图例字体</Label>
                  <FontSelect
                    value={comp.legendFontFamily}
                    onChange={(v) => updateComparison(i, { legendFontFamily: v })}
                  />
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
