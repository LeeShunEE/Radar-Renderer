/**
 * 任务队列面板：展示用户渲染任务列表 + 状态 + 操作。
 */
"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useTaskQueue } from "@/hooks/useTaskQueue";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TaskEtaDisplay } from "./TaskEtaDisplay";
import { RefreshCw, Trash2, Download, Clock, Gauge, AlertTriangle } from "lucide-react";
import { files, TaskResponse } from "@/lib/api-client";
import { formatEtaSeconds } from "@/lib/format";

export function TaskQueuePanel() {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { tasks, queueSize, avgFps, loading, error, refreshTasks, deleteTask } = useTaskQueue();

  // 删除确认 Dialog 状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<TaskResponse | null>(null);

  const handleDownload = async (taskId: number, codec: string) => {
    // 产物端点需鉴权：先带 token 拉 Blob，再用 blob URL 触发保存。
    // 直接 <a href> 直链会不带 token 而 401。
    const blob = await files.fetchOutputBlob(taskId);
    const ext = codec === "h264" ? "mp4" : "gif";
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `render-${taskId}.${ext}`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  const handleDeleteClick = (task: TaskResponse) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (taskToDelete) {
      deleteTask(taskToDelete.id);
      setTaskToDelete(null);
    }
  };

  const getDeleteDialogTitle = (task: TaskResponse) => {
    if (task.file_expired) {
      return t("delete.title.record");
    }
    if (task.status === "done" && task.output_exists) {
      return t("delete.title.withOutput");
    }
    return t("delete.title.task");
  };

  const getDeleteDialogDescription = (task: TaskResponse) => {
    if (task.file_expired) {
      return t("delete.description.record");
    }
    if (task.status === "done" && task.output_exists) {
      return t("delete.description.withOutput");
    }
    return t("delete.description.task");
  };

  // 按创建时间倒序
  const sortedTasks = [...tasks].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="space-y-4">
      {/* 队列状态 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {t("queuePending", { count: queueSize })}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {avgFps !== null
                ? t("avgFps", { fps: avgFps.toFixed(1) })
                : t("avgFpsCalculating")}
            </span>
          </div>
          <Button
            onClick={refreshTasks}
            disabled={loading}
            variant="ghost"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="text-xs text-geist-error">{error}</p>
      )}

      {/* 任务列表 */}
      {loading && tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          {tc("loading")}
        </p>
      ) : sortedTasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          {t("empty")}
        </p>
      ) : (
        <div className="border border-unfocused-border-color rounded-md overflow-hidden">
          {sortedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-unfocused-border-color last:border-b-0 hover:bg-muted/50 transition-colors"
            >
              {/* 任务 ID */}
              <span className="text-xs text-muted-foreground shrink-0">
                #{task.id}
              </span>

              {/* 状态徽章 */}
              <TaskStatusBadge status={task.status} />

              {/* 模式 + 编码 */}
              <span className="text-xs shrink-0">
                {t(task.mode === "single" ? "mode.single" : "mode.all")} ·{" "}
                {task.codec === "h264" ? "MP4" : "GIF"}
              </span>

              {/* 创建时间 */}
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(task.created_at).toLocaleString(
                  locale === "zh" ? "zh-CN" : "en-US",
                  {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}
              </span>

              {/* 过期提示 */}
              {task.file_expired && (
                <div className="flex items-center gap-1 text-xs text-geist-error shrink-0">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{t("outputCleaned")}</span>
                </div>
              )}

              {/* ETA */}
              {task.status === "queued" && (
                <TaskEtaDisplay etaSeconds={task.eta_seconds} position={task.position} />
              )}

              {/* 运行中进度条 + 剩余 ETA */}
              {task.status === "running" && (
                <div className="flex items-center gap-2 min-w-0 flex-1 max-w-[240px]">
                  <Progress
                    value={
                      task.total_frames && task.total_frames > 0 && task.rendered_frames !== null
                        ? (task.rendered_frames / task.total_frames) * 100
                        : 0
                    }
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {task.total_frames && task.total_frames > 0 && task.rendered_frames !== null
                      ? `${task.rendered_frames}/${task.total_frames}`
                      : t("status.running")}
                    {task.eta_seconds !== null && task.eta_seconds > 0
                      ? ` · ${t("remaining", { eta: formatEtaSeconds(task.eta_seconds, locale as "en" | "zh") })}`
                      : ""}
                  </span>
                </div>
              )}

              {/* 耗时 */}
              {task.duration_ms !== null && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {t("duration", { seconds: (task.duration_ms / 1000).toFixed(1) })}
                </span>
              )}

              {/* 操作按钮 */}
              <div className="flex items-center gap-1 ml-auto shrink-0">
                {/* 下载按钮（仅已完成且文件存在） */}
                {task.status === "done" && task.output_exists && (
                  <Button
                    onClick={() => handleDownload(task.id, task.codec)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                  >
                    <Download className="w-3 h-3 text-green-500" />
                  </Button>
                )}

                {/* 删除按钮 */}
                {(task.status === "queued" || task.status === "done" || task.status === "failed" || task.status === "canceled") && (
                  <Button
                    onClick={() => handleDeleteClick(task)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                  >
                    <Trash2 className="w-3 h-3 text-geist-error" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 删除确认 Dialog */}
      {taskToDelete && (
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={getDeleteDialogTitle(taskToDelete)}
          description={getDeleteDialogDescription(taskToDelete)}
          confirmLabel={tc("delete")}
          danger={taskToDelete.status === "done" && taskToDelete.output_exists}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}