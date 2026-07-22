/**
 * 导出面板：服务端渲染 + 本地 MP4/WebM 渲染。
 *
 * 本地渲染使用 WebCodecs 输出 MP4（带音频），不支持时回退 WebM（无音频）。
 */
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Progress } from "../ui/progress";
import type { RadarVideoProps, MultiPageConfig } from "../../types/radar";
import { calculateDuration, calculateComparisonDuration, VIDEO_FPS } from "../../types/constants";
import { useServerRender } from "../../hooks/useServerRender";
import { useLocalRender } from "../../hooks/useLocalRender";
import { applyGlobalOverride } from "../../lib/global-override";
import { formatEtaSeconds } from "../../lib/format";

type ExportPanelProps = {
  props: RadarVideoProps;
  config: MultiPageConfig;
  /** 当前预览模式：single（单页）/ multi（全局）。决定渲染范围的约束规则。 */
  previewMode: "single" | "multi";
};

export function ExportPanel({ props, config, previewMode }: ExportPanelProps) {
  const t = useTranslations("editor.export");
  const serverRender = useServerRender();
  const localRender = useLocalRender();
  const [exportMode, setExportMode] = useState<"server" | "local">("server");
  // 渲染范围：当前页 / 全部页面（仅服务端渲染有效）。
  const [renderRange, setRenderRange] = useState<"current" | "all">("current");

  const totalPages = config.pages.length;

  // 计算单页时长
  const singleFrames = calculateDuration(applyGlobalOverride(props, config.globalOverride).animation);

  // 计算多页总时长（与 PreviewPanel 一致）
  const multiFrames = (() => {
    if (!config.pages.length) return 0;
    const mergedPages = config.pages.map((p) => applyGlobalOverride(p, config.globalOverride));
    const compMap = new Map<number, (typeof config.comparisons)[number]>();
    for (const c of config.comparisons) compMap.set(c.firstPageIndex, c);
    const compared = new Set<number>();
    let frames = 0;
    for (let i = 0; i < config.pages.length; i++) {
      if (compared.has(i)) continue;
      const comp = compMap.get(i);
      if (comp && i + 1 < config.pages.length) {
        frames += calculateComparisonDuration(mergedPages[i], mergedPages[i + 1], comp);
        compared.add(i);
        compared.add(i + 1);
      } else {
        frames += calculateDuration(mergedPages[i].animation);
      }
    }
    return frames;
  })();

  // 渲染范围派生规则：
  // - multi 预览：强制全部（当前页灰禁 + 全部锁定已选）。
  // - single 预览 + 仅 1 页：强制当前页（全部灰禁）。
  // - single 预览 + 多页：按 renderRange 选择。
  const effectiveRange: "current" | "all" =
    previewMode === "multi" ? "all"
    : totalPages <= 1 ? "current"
    : renderRange;
  const currentDisabled = previewMode === "multi";
  const allDisabled = totalPages <= 1 || previewMode === "multi";

  // 服务端渲染状态文案（rendering 走下方独立进度区，这里返回 null）
  const getServerStatusText = () => {
    switch (serverRender.status) {
      case "idle":
        return null;
      case "submitting":
        return t("status.submitting");
      case "queued": {
        const pos = serverRender.currentTask?.position ?? 0;
        const eta = serverRender.currentTask?.eta_seconds ?? 0;
        const size = serverRender.currentTask?.queue_size ?? 0;
        return t("status.queued", { pos, size, eta: formatEtaSeconds(eta) });
      }
      case "rendering":
        return null;
      case "downloading":
        return t("status.downloading");
      case "done":
        return t("status.done");
      case "failed":
        return t("status.failed", { error: serverRender.error ?? "" });
    }
  };

  // 服务端渲染中进度区：进度条 + 帧数 + 运行中剩余 ETA
  const renderProgress = () => {
    if (serverRender.status !== "rendering") return null;
    const task = serverRender.currentTask;
    const rendered = task?.rendered_frames ?? null;
    const total = task?.total_frames ?? null;
    const eta = task?.eta_seconds ?? null;
    const hasFrames = total !== null && total > 0 && rendered !== null;
    const value = hasFrames ? (rendered / total) * 100 : 0;

    return (
      <div className="space-y-1">
        <Progress value={value} />
        <p className="text-xs text-muted-foreground">
          {hasFrames
            ? t("progress.rendering", { rendered, total }) +
              (eta !== null ? t("progress.etaSuffix", { eta: formatEtaSeconds(eta) }) : "")
            : t("progress.renderingNoFrames")}
        </p>
      </div>
    );
  };

  // 本地渲染状态文案
  const getLocalStatusText = () => {
    if (localRender.rendering) {
      return t("localStatus.rendering", { progress: localRender.progress.toFixed(0) });
    }
    if (localRender.error) {
      return t("localStatus.failed", { error: localRender.error });
    }
    return null;
  };

  // 提交服务端渲染
  const handleServerRender = (codec: "h264" | "gif", renderType: "single" | "multi") => {
    const inputProps = renderType === "multi"
      ? { config }
      : applyGlobalOverride(props, config.globalOverride);
    serverRender.submitRender(renderType, codec, inputProps as Record<string, unknown>);
  };

  // 开始本地渲染（单页）
  const handleLocalRenderSingle = () => {
    localRender.startLocalRender("single", props, config);
  };

  // 开始本地渲染（多页）
  const handleLocalRenderMulti = () => {
    localRender.startLocalRender("multi", props, config);
  };

  return (
    <div className="space-y-3 border border-unfocused-border-color rounded-lg p-4">
      <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>

      {/* 渲染模式切换 */}
      <div className="flex items-center gap-2">
        <Label className="text-xs">{t("mode.label")}</Label>
        <button
          onClick={() => setExportMode("server")}
          className={`px-2 py-1 text-xs rounded ${
            exportMode === "server"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {t("mode.server")}
        </button>
        <button
          onClick={() => setExportMode("local")}
          className={`px-2 py-1 text-xs rounded ${
            exportMode === "local"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {t("mode.local")}
        </button>
      </div>

      {/* 本地渲染提示 */}
      {exportMode === "local" && (
        <p className="text-xs text-muted-foreground">
          {t("localHint")}
          {localRender.mp4Supported === false && (
            <span className="text-geist-error ml-1">
              {t("localFallback")}
            </span>
          )}
        </p>
      )}

      {/* 服务端渲染资源提示 */}
      {exportMode === "server" && (
        <p className="text-xs text-muted-foreground">
          {t("serverHint")}
        </p>
      )}

      {/* 渲染范围选择器（仅服务端渲染有效） */}
      {exportMode === "server" && (
        <div className="flex items-center gap-2">
          <Label className="text-xs">{t("rangeLabel")}</Label>
          <button
            onClick={() => setRenderRange("current")}
            disabled={currentDisabled}
            title={currentDisabled ? t("rangeCurrentDisabledTip") : undefined}
            className={`px-2 py-1 text-xs rounded ${
              effectiveRange === "current"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            } ${currentDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {t("rangeCurrent")}
          </button>
          <button
            onClick={() => setRenderRange("all")}
            disabled={allDisabled}
            title={totalPages <= 1 ? t("rangeAllTip") : undefined}
            className={`px-2 py-1 text-xs rounded ${
              effectiveRange === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            } ${allDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {t("rangeAll")}
          </button>
        </div>
      )}

      {/* 服务端渲染 */}
      {exportMode === "server" && (
        <>
          {/* 状态显示 */}
          {getServerStatusText() && (
            <p className="text-xs text-muted-foreground">
              {getServerStatusText()}
            </p>
          )}

          {/* 渲染中进度 */}
          {renderProgress()}

          {/* 按 effectiveRange 显示一组导出按钮 */}
          {effectiveRange === "current" ? (
            <div className="space-y-2">
              <p className="text-xs text-subtitle">
                {t("exportCurrentLine", { name: props.characterName, frames: singleFrames, seconds: (singleFrames / VIDEO_FPS).toFixed(1) })}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleServerRender("h264", "single")}
                  disabled={serverRender.status !== "idle" && serverRender.status !== "done" && serverRender.status !== "failed"}
                  className="flex-1"
                  size="sm"
                >
                  {t("currentMp4")}
                </Button>
                <Button
                  onClick={() => handleServerRender("gif", "single")}
                  disabled={serverRender.status !== "idle" && serverRender.status !== "done" && serverRender.status !== "failed"}
                  variant="outline"
                  className="flex-1"
                  size="sm"
                >
                  {t("currentGif")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-subtitle">
                {t("exportAllLine", { pages: totalPages, frames: multiFrames, seconds: (multiFrames / VIDEO_FPS).toFixed(1) })}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleServerRender("h264", "multi")}
                  disabled={serverRender.status !== "idle" && serverRender.status !== "done" && serverRender.status !== "failed"}
                  className="flex-1"
                  size="sm"
                  variant="secondary"
                >
                  {t("allMp4")}
                </Button>
                <Button
                  onClick={() => handleServerRender("gif", "multi")}
                  disabled={serverRender.status !== "idle" && serverRender.status !== "done" && serverRender.status !== "failed"}
                  variant="outline"
                  className="flex-1"
                  size="sm"
                >
                  {t("allGif")}
                </Button>
              </div>
            </div>
          )}

          {/* 取消按钮 */}
          {(serverRender.status === "queued" || serverRender.status === "rendering") && (
            <Button
              onClick={serverRender.cancelRender}
              variant="ghost"
              size="sm"
              className="text-geist-error"
            >
              {t("cancelTask")}
            </Button>
          )}
        </>
      )}

      {/* 本地渲染 */}
      {exportMode === "local" && (
        <>
          {/* 状态显示 */}
          {getLocalStatusText() && (
            <p className="text-xs text-muted-foreground">
              {getLocalStatusText()}
            </p>
          )}

          {/* 单页导出 */}
          <div className="space-y-2">
            <p className="text-xs text-subtitle">
              {t("exportCurrentLine", { name: props.characterName, frames: singleFrames, seconds: (singleFrames / VIDEO_FPS).toFixed(1) })}
            </p>
            <Button
              onClick={handleLocalRenderSingle}
              disabled={localRender.rendering}
              className="w-full"
              size="sm"
            >
              {localRender.rendering ? t("buttonRendering") : t("localCurrentMp4")}
            </Button>
          </div>

          {/* 全部导出 */}
          {totalPages > 1 && (
            <div className="space-y-2">
              <p className="text-xs text-subtitle">
                {t("exportAllLine", { pages: totalPages, frames: multiFrames, seconds: (multiFrames / VIDEO_FPS).toFixed(1) })}
              </p>
              <Button
                onClick={handleLocalRenderMulti}
                disabled={localRender.rendering}
                className="w-full"
                size="sm"
                variant="secondary"
              >
                {localRender.rendering ? t("buttonRendering") : t("localAllMp4")}
              </Button>
            </div>
          )}

          {/* 取消按钮 */}
          {localRender.rendering && (
            <Button
              onClick={localRender.cancel}
              variant="ghost"
              size="sm"
              className="text-geist-error"
            >
              {t("cancelLocal")}
            </Button>
          )}
        </>
      )}

      {/* LocalRenderStage 渲染入口 */}
      {localRender.renderStage()}
    </div>
  );
}