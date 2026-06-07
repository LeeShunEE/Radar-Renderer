/**
 * 服务端渲染 hook：提交任务 → 轮询状态 → 完成后下载。
 */
import { useState, useCallback, useEffect } from "react";
import { render, files, tasks, TaskResponse } from "@/lib/api-client";
import { useTaskPolling } from "./useTaskPolling";

export interface UseServerRenderResult {
  /** 当前渲染状态。 */
  status: "idle" | "submitting" | "queued" | "rendering" | "downloading" | "done" | "failed";
  /** 当前任务。 */
  currentTask: TaskResponse | null;
  /** 错误信息。 */
  error: string | null;
  /** 提交服务端渲染任务。 */
  submitRender: (mode: "single" | "multi", codec: "h264" | "gif", inputProps: Record<string, unknown>) => Promise<void>;
  /** 取消当前任务。 */
  cancelRender: () => Promise<void>;
}

export function useServerRender(): UseServerRenderResult {
  const [status, setStatus] = useState<"idle" | "submitting" | "queued" | "rendering" | "downloading" | "done" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const { task, isPolling, error: pollingError, start: startPolling, stop: stopPolling } = useTaskPolling();

  /** 触发浏览器下载产物。 */
  const triggerDownload = useCallback(async (t: TaskResponse) => {
    setStatus("downloading");
    try {
      const url = files.downloadOutput(t.id);
      // 使用 fetch 获取文件并触发下载
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("下载产物失败");
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const ext = t.codec === "h264" ? "mp4" : "gif";
      const filename = `render-${t.id}.${ext}`;

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();

      URL.revokeObjectURL(blobUrl);
      setStatus("done");
      stopPolling();
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : "下载失败");
      stopPolling();
    }
  }, [stopPolling]);

  /** 监听任务状态变化。 */
  useEffect(() => {
    if (!task || !isPolling) return;

    // 跳过正在下载或已完成的状态
    if (status === "downloading" || status === "done") return;

    const taskStatus = task.status;

    if (taskStatus === "queued" && status !== "queued") {
      setStatus("queued");
    } else if (taskStatus === "running" && status !== "rendering") {
      setStatus("rendering");
    } else if (taskStatus === "done") {
      triggerDownload(task);
    } else if (taskStatus === "failed") {
      setStatus("failed");
      setError(task.error || "渲染失败");
      stopPolling();
    } else if (taskStatus === "canceled") {
      setStatus("idle");
      setError("任务已取消");
      stopPolling();
    }
  }, [task, isPolling, status, triggerDownload, stopPolling]);

  /** 提交渲染任务。 */
  const submitRender = useCallback(async (
    mode: "single" | "multi",
    codec: "h264" | "gif",
    inputProps: Record<string, unknown>,
  ) => {
    setStatus("submitting");
    setError(null);
    stopPolling();

    try {
      const taskData = await render.submit(mode, codec, inputProps);
      setStatus("queued");
      startPolling(taskData.id);
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : "提交渲染失败");
    }
  }, [startPolling, stopPolling]);

  /** 取消渲染任务。 */
  const cancelRender = useCallback(async () => {
    if (task) {
      try {
        await tasks.delete(task.id);
        stopPolling();
        setStatus("idle");
        setError("任务已取消");
      } catch (e) {
        setError(e instanceof Error ? e.message : "取消任务失败");
      }
    }
  }, [task, stopPolling]);

  /** 合并 polling error。 */
  const finalError = error || pollingError;

  return {
    status,
    currentTask: task,
    error: finalError,
    submitRender,
    cancelRender,
  };
}