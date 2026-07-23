/**
 * 任务轮询 hook：给定 taskId，返回 task + isPolling + stop。
 * 终态（done/failed/canceled）时自动停止轮询。
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { tasks, TaskResponse } from "@/lib/api-client";

const POLL_INTERVAL_MS = 2000;

export interface UseTaskPollingResult {
  task: TaskResponse | null;
  isPolling: boolean;
  error: string | null;
  start: (taskId: number) => void;
  stop: () => void;
}

export function useTaskPolling(): UseTaskPollingResult {
  const tr = useTranslations("errors");
  const [task, setTask] = useState<TaskResponse | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taskIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /** 拉取任务状态。 */
  const fetchTask = useCallback(async (taskId: number) => {
    try {
      const data = await tasks.get(taskId);
      setTask(data);
      setError(null);

      // 终态时自动停止
      if (data.status === "done" || data.status === "failed" || data.status === "canceled") {
        stop();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("taskStatusFailed"));
      stop();
    }
  }, [tr]);

  /** 开始轮询。 */
  const start = useCallback((taskId: number) => {
    taskIdRef.current = taskId;
    setIsPolling(true);
    setError(null);

    // 立即拉取一次
    fetchTask(taskId);

    // 开始定时轮询
    intervalRef.current = setInterval(() => {
      if (taskIdRef.current !== null) {
        fetchTask(taskIdRef.current);
      }
    }, POLL_INTERVAL_MS);
  }, [fetchTask]);

  /** 停止轮询。 */
  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    taskIdRef.current = null;
    setIsPolling(false);
  }, []);

  /** 清理：组件卸载时停止轮询。 */
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { task, isPolling, error, start, stop };
}