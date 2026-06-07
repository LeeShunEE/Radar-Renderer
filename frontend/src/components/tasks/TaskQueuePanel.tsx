/**
 * 任务队列面板：展示用户渲染任务列表 + 状态 + 操作。
 */
"use client";

import { Button } from "@/components/ui/button";
import { useTaskQueue } from "@/hooks/useTaskQueue";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TaskEtaDisplay } from "./TaskEtaDisplay";
import { RefreshCw, Trash2, Download, Clock } from "lucide-react";
import { files } from "@/lib/api-client";

export function TaskQueuePanel() {
  const { tasks, queueSize, loading, error, refreshTasks, deleteTask } = useTaskQueue();

  const handleDownload = (taskId: number, codec: string) => {
    const url = files.downloadOutput(taskId);
    const ext = codec === "h264" ? "mp4" : "gif";
    const a = document.createElement("a");
    a.href = url;
    a.download = `render-${taskId}.${ext}`;
    a.click();
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
            队列中 {queueSize} 个任务待渲染
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

      {/* 错误提示 */}
      {error && (
        <p className="text-xs text-geist-error">{error}</p>
      )}

      {/* 任务列表 */}
      {loading && tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          加载中...
        </p>
      ) : sortedTasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          暂无渲染任务
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
                {task.mode === "single" ? "单页" : "全部"} · {task.codec === "h264" ? "MP4" : "GIF"}
              </span>

              {/* 创建时间 */}
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(task.created_at).toLocaleString("zh-CN", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>

              {/* ETA */}
              {task.status === "queued" && (
                <TaskEtaDisplay etaSeconds={task.eta_seconds} position={task.position} />
              )}

              {/* 耗时 */}
              {task.duration_ms !== null && (
                <span className="text-xs text-muted-foreground shrink-0">
                  耗时 {(task.duration_ms / 1000).toFixed(1)} 秒
                </span>
              )}

              {/* 操作按钮 */}
              <div className="flex items-center gap-1 ml-auto shrink-0">
                {/* 下载按钮（仅已完成） */}
                {task.status === "done" && (
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
                    onClick={() => deleteTask(task.id)}
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
    </div>
  );
}