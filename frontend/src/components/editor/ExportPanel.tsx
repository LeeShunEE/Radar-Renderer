/**
 * 导出面板：服务端渲染 + 本地 MP4/WebM 渲染。
 *
 * 本地渲染使用 WebCodecs 输出 MP4（带音频），不支持时回退 WebM（无音频）。
 */
"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import type { RadarVideoProps, MultiPageConfig } from "../../types/radar";
import { calculateDuration, calculateComparisonDuration, VIDEO_FPS } from "../../types/constants";
import { useServerRender } from "../../hooks/useServerRender";
import { useLocalRender } from "../../hooks/useLocalRender";
import { applyGlobalOverride } from "../../lib/global-override";

type ExportPanelProps = {
  props: RadarVideoProps;
  config: MultiPageConfig;
};

export function ExportPanel({ props, config }: ExportPanelProps) {
  const serverRender = useServerRender();
  const localRender = useLocalRender();
  const [exportMode, setExportMode] = useState<"server" | "local">("server");

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

  // 服务端渲染状态文案
  const getServerStatusText = () => {
    switch (serverRender.status) {
      case "idle":
        return null;
      case "submitting":
        return "提交任务...";
      case "queued": {
        const pos = serverRender.currentTask?.position ?? 0;
        const eta = serverRender.currentTask?.eta_seconds ?? 0;
        return `排队中（第 ${pos} 位，预计 ${eta} 秒）`;
      }
      case "rendering":
        return "渲染中...";
      case "downloading":
        return "完成！正在下载...";
      case "done":
        return "下载完成";
      case "failed":
        return `失败：${serverRender.error}`;
    }
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

      {/* 服务端渲染 */}
      {exportMode === "server" && (
        <>
          {/* 状态显示 */}
          {getServerStatusText() && (
            <p className="text-xs text-muted-foreground">
              {getServerStatusText()}
            </p>
          )}

          {/* 单页导出 */}
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

          {/* 全部导出 */}
          {totalPages > 1 && (
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