/**
 * 文件管理面板：上传/列举/删除用户文件 + 配额进度条。
 */
"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useFileManagement } from "@/hooks/useFileManagement";
import { Upload, Trash2, RefreshCw, FileIcon, AlertCircle } from "lucide-react";

export function FileManagerPanel() {
  const {
    files,
    quota,
    loading,
    uploading,
    error,
    refresh,
    upload,
    deleteFile,
    downloadFile,
    formatQuota,
    quotaPercent,
  } = useFileManagement();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await upload(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      // 错误已在 hook 中处理
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`确定删除 "${name}"？`)) return;
    setDeleting(name);
    try {
      await deleteFile(name);
    } catch {
      // 错误已在 hook 中处理
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 配额进度条 */}
      {quota && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              已用 {formatQuota(quota.used_bytes)} / {formatQuota(quota.limit_bytes)}
            </span>
            <span className="text-muted-foreground">
              {quotaPercent.toFixed(1)}%
            </span>
          </div>
          <Progress value={quotaPercent} className="h-2" />
          {quotaPercent >= 90 && (
            <p className="text-xs text-geist-warning flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              存储空间即将用尽
            </p>
          )}
        </div>
      )}

      {/* 上传按钮 */}
      <div className="flex items-center gap-2">
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || (quota?.available_bytes ?? 0) <= 0}
          size="sm"
        >
          <Upload className="w-4 h-4 mr-1" />
          {uploading ? "上传中..." : "上传文件"}
        </Button>
        <Button
          onClick={refresh}
          disabled={loading}
          variant="ghost"
          size="sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="text-xs text-geist-error flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}

      {/* 文件列表 */}
      {loading && files.length === 0 ? (
        <p className="text-xs text-muted-foreground">加载中...</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          暂无上传文件
        </p>
      ) : (
        <div className="border border-unfocused-border-color rounded-md overflow-hidden">
          {files.map((file) => (
            <div
              key={file.name}
              className="flex items-center gap-2 px-3 py-2 border-b border-unfocused-border-color last:border-b-0 hover:bg-muted/50 transition-colors"
            >
              <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              {/* 上传文件端点需鉴权，用按钮走带 token 的 Blob 下载（裸 <a href> 会 401）。 */}
              <button
                type="button"
                onClick={() => downloadFile(file.name)}
                className="text-sm truncate flex-1 text-left hover:text-primary"
                title={file.name}
              >
                {file.name}
              </button>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatQuota(file.size_bytes)}
              </span>
              <Button
                onClick={() => handleDelete(file.name)}
                disabled={deleting === file.name}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                <Trash2 className="w-3 h-3 text-geist-error" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}