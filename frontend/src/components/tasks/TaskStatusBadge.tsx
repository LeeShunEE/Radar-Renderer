/**
 * 任务状态徽章：不同状态显示不同颜色。
 */
"use client";

import { useTranslations } from "next-intl";

interface TaskStatusBadgeProps {
  status: string;
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const t = useTranslations("tasks.status");

  const getColorClass = () => {
    switch (status) {
      case "queued":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
      case "running":
        return "bg-blue-500/20 text-blue-400 border-blue-500/50";
      case "done":
        return "bg-green-500/20 text-green-400 border-green-500/50";
      case "failed":
        return "bg-red-500/20 text-red-400 border-red-500/50";
      case "canceled":
        return "bg-gray-500/20 text-gray-400 border-gray-500/50";
      default:
        return "bg-muted text-muted-foreground border-unfocused-border-color";
    }
  };

  const getText = () => {
    switch (status) {
      case "queued":
        return t("queued");
      case "running":
        return t("running");
      case "done":
        return t("done");
      case "failed":
        return t("failed");
      case "canceled":
        return t("canceled");
      default:
        return status;
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getColorClass()}`}
    >
      {getText()}
    </span>
  );
}