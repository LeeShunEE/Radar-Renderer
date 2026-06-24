/**
 * 任务队列 hook：任务列表 + 轮询刷新 + 删除任务。
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { tasks, TaskResponse } from "@/lib/api-client";

const POLL_INTERVAL_MS = 5000;

export interface UseTaskQueueResult {
  /** 任务列表。 */
  tasks: TaskResponse[];
  /** 队列大小。 */
  queueSize: number;
  /** 近期平均渲速（帧/秒）；无样本时为 null。 */
  avgFps: number | null;
  /** 是否正在加载。 */
  loading: boolean;
  /** 错误信息。 */
  error: string | null;
  /** 手动刷新。 */
  refreshTasks: () => Promise<void>;
  /** 删除任务。 */
  deleteTask: (id: number) => Promise<void>;
}

export function useTaskQueue(): UseTaskQueueResult {
  const [taskList, setTaskList] = useState<TaskResponse[]>([]);
  const [queueSize, setQueueSize] = useState(0);
  const [avgFps, setAvgFps] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /** 刷新任务列表。 */
  const refreshTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tasks.list();
      setTaskList(data.tasks);
      setQueueSize(data.queue_size);
      setAvgFps(data.avg_fps ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取任务列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  /** 删除任务。 */
  const deleteTask = useCallback(async (id: number) => {
    try {
      await tasks.delete(id);
      // 删除成功后刷新列表
      await refreshTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除任务失败");
    }
  }, [refreshTasks]);

  /** 初始化加载。 */
  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  /** 自动轮询：有活动任务时每 5s 刷新，全部终态时停止。 */
  useEffect(() => {
    const hasActiveTasks = taskList.some(
      (t) => t.status === "queued" || t.status === "running",
    );

    if (hasActiveTasks) {
      intervalRef.current = setInterval(refreshTasks, POLL_INTERVAL_MS);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [taskList, refreshTasks]);

  return {
    tasks: taskList,
    queueSize,
    avgFps,
    loading,
    error,
    refreshTasks,
    deleteTask,
  };
}