/**
 * 导出面板：服务端渲染 + 本地 MP4/WebM 渲染。
 *
 * 本地渲染使用 WebCodecs 输出 MP4（带音频），不支持时回退 WebM（无音频）。
 */
"use client";

import { useState } from "react";
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
    let t = 0;
    for (let i = 0; i < config.pages.length; i++) {
      if (compared.has(i)) continue;
      const comp = compMap.get(i);
      if (comp && i + 1 < config.pages.length) {
        t += calculateComparisonDuration(mergedPages[i], mergedPages[i + 1], comp);
        compared.add(i);
        compared.add(i + 1);
      } else {
        t += calculateDuration(mergedPages[i].animation);
      }
    }
    return t;
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
        return "提交任务...";
      case "queued": {
        const pos = serverRender.currentTask?.position ?? 0;
        const eta = serverRender.currentTask?.eta_seconds ?? 0;
        const size = serverRender.currentTask?.queue_size ?? 0;
        return `排队中（第 ${pos} 位 / 共 ${size} 个，预计 ${formatEtaSeconds(eta)}）`;
      }
      case "rendering":
        return null;
      case "downloading":
        return "完成！正在下载...";
      case "done":
        return "下载完成";
      case "failed":
        return `失败：${serverRender.error}`;
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
            ? `渲染中 第 ${rendered}/${total} 帧${
                eta !== null ? ` · 预计剩余 ${formatEtaSeconds(eta)}` : ""
              }`
            : "渲染中..."}
        </p>
      </div>
    );
  };

  // 本地渲染状态文案
  const getLocalStatusText = () => {
    if (localRender.rendering) {
      return `本地渲染中... ${localRender.progress.toFixed(0)}%`;
    }
    if (localRender.error) {
      return `失败：${localRender.error}`;
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
      <h3 className="text-sm font-semibold text-foreground">导出</h3>

      {/* 渲染模式切换 */}
      <div className="flex items-center gap-2">
        <Label className="text-xs">渲染方式：</Label>
        <button
          onClick={() => setExportMode("server")}
          className={`px-2 py-1 text-xs rounded ${
            exportMode === "server"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          服务端
        </button>
        <button
          onClick={() => setExportMode("local")}
          className={`px-2 py-1 text-xs rounded ${
            exportMode === "local"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          本地浏览器
        </button>
      </div>

      {/* 本地渲染提示 */}
      {exportMode === "local" && (
        <p className="text-xs text-muted-foreground">
          本地渲染输出 MP4 格式（带音频），需要浏览器支持 WebCodecs。
          {localRender.mp4Supported === false && (
            <span className="text-geist-error ml-1">
              当前浏览器不支持，将导出无音频 WebM。
            </span>
          )}
        </p>
      )}

      {/* 服务端渲染资源提示 */}
      {exportMode === "server" && (
        <p className="text-xs text-muted-foreground">
          服务器资源有限，渲染较慢、排队较久（可在下方任务列表查看当前负载与平均渲速）。
          建议仅在需要关闭浏览器的场景使用服务端渲染。
        </p>
      )}

      {/* 渲染范围选择器（仅服务端渲染有效） */}
      {exportMode === "server" && (
        <div className="flex items-center gap-2">
          <Label className="text-xs">渲染范围：</Label>
          <button
            onClick={() => setRenderRange("current")}
            disabled={currentDisabled}
            title={currentDisabled ? "当前已经选中全局了" : undefined}
            className={`px-2 py-1 text-xs rounded ${
              effectiveRange === "current"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            } ${currentDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            渲染当前页
          </button>
          <button
            onClick={() => setRenderRange("all")}
            disabled={allDisabled}
            title={totalPages <= 1 ? "当前只有 1 页" : undefined}
            className={`px-2 py-1 text-xs rounded ${
              effectiveRange === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            } ${allDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            渲染全部页面
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
                导出当前页：{props.characterName}（{singleFrames} 帧 / {(singleFrames / VIDEO_FPS).toFixed(1)} 秒）
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleServerRender("h264", "single")}
                  disabled={serverRender.status !== "idle" && serverRender.status !== "done" && serverRender.status !== "failed"}
                  className="flex-1"
                  size="sm"
                >
                  导出当前页 MP4
                </Button>
                <Button
                  onClick={() => handleServerRender("gif", "single")}
                  disabled={serverRender.status !== "idle" && serverRender.status !== "done" && serverRender.status !== "failed"}
                  variant="outline"
                  className="flex-1"
                  size="sm"
                >
                  导出当前页 GIF
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-subtitle">
                导出全部页面：{totalPages} 页，共 {multiFrames} 帧 / {(multiFrames / VIDEO_FPS).toFixed(1)} 秒
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleServerRender("h264", "multi")}
                  disabled={serverRender.status !== "idle" && serverRender.status !== "done" && serverRender.status !== "failed"}
                  className="flex-1"
                  size="sm"
                  variant="secondary"
                >
                  导出全部 MP4
                </Button>
                <Button
                  onClick={() => handleServerRender("gif", "multi")}
                  disabled={serverRender.status !== "idle" && serverRender.status !== "done" && serverRender.status !== "failed"}
                  variant="outline"
                  className="flex-1"
                  size="sm"
                >
                  导出全部 GIF
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
              取消任务
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
              导出当前页：{props.characterName}（{singleFrames} 帧 / {(singleFrames / VIDEO_FPS).toFixed(1)} 秒）
            </p>
            <Button
              onClick={handleLocalRenderSingle}
              disabled={localRender.rendering}
              className="w-full"
              size="sm"
            >
              {localRender.rendering ? "渲染中..." : "导出当前页 MP4（本地）"}
            </Button>
          </div>

          {/* 全部导出 */}
          {totalPages > 1 && (
            <div className="space-y-2">
              <p className="text-xs text-subtitle">
                导出全部页面：{totalPages} 页，共 {multiFrames} 帧 / {(multiFrames / VIDEO_FPS).toFixed(1)} 秒
              </p>
              <Button
                onClick={handleLocalRenderMulti}
                disabled={localRender.rendering}
                className="w-full"
                size="sm"
                variant="secondary"
              >
                {localRender.rendering ? "渲染中..." : "导出全部 MP4（本地）"}
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
              取消渲染
            </Button>
          )}
        </>
      )}

      {/* LocalRenderStage 渲染入口 */}
      {localRender.renderStage()}
    </div>
  );
}