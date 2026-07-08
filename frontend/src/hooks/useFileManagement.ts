/**
 * 文件管理 hook：封装用户上传文件的 CRUD + 配额查询。
 */
import { useState, useCallback, useEffect } from "react";
import { files } from "@/lib/api-client";

export interface UserFile {
  name: string;
  size_bytes: number;
  modified_at: string;
}

export interface QuotaInfo {
  used_bytes: number;
  limit_bytes: number;
  available_bytes: number;
}

export interface FileManagementState {
  files: UserFile[];
  quota: QuotaInfo | null;
  loading: boolean;
  uploading: boolean;
  /** 上传进度百分比（0-100），非上传中为 null */
  uploadProgress: number | null;
  error: string | null;
}

export function useFileManagement() {
  const [state, setState] = useState<FileManagementState>({
    files: [],
    quota: null,
    loading: false,
    uploading: false,
    uploadProgress: null,
    error: null,
  });

  /** 刷新文件列表与配额。 */
  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await files.list();
      setState({
        files: data.files,
        quota: data.quota,
        loading: false,
        uploading: false,
        uploadProgress: null,
        error: null,
      });
    } catch (e) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : "获取文件列表失败",
      }));
    }
  }, []);

  /** 初始化时自动加载。 */
  useEffect(() => {
    refresh();
  }, [refresh]);

  /** 上传文件。 */
  const upload = useCallback(async (file: File) => {
    setState((prev) => ({ ...prev, uploading: true, uploadProgress: 0, error: null }));
    try {
      await files.upload(file, (percent) => {
        setState((prev) => ({ ...prev, uploadProgress: percent }));
      });
      // 上传成功后刷新列表（refresh 会重置 uploading / uploadProgress）
      await refresh();
    } catch (e) {
      setState((prev) => ({
        ...prev,
        uploading: false,
        uploadProgress: null,
        error: e instanceof Error ? e.message : "上传失败",
      }));
      throw e;
    }
  }, [refresh]);

  /** 删除文件。 */
  const deleteFile = useCallback(async (name: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await files.delete(name);
      // 删除成功后刷新列表
      await refresh();
    } catch (e) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : "删除失败",
      }));
      throw e;
    }
  }, [refresh]);

  /** 获取上传文件的下载 URL（用于在素材中按 URL 引用，渲染端按需鉴权）。 */
  const getDownloadUrl = useCallback((name: string) => {
    return files.downloadUpload(name);
  }, []);

  /**
   * 下载上传文件到本地。
   *
   * 上传文件端点需鉴权，裸 `<a href>` 直链会 401；统一走带 token 的 Blob 拉取再触发保存。
   */
  const downloadFile = useCallback(async (name: string) => {
    setState((prev) => ({ ...prev, error: null }));
    try {
      const blob = await files.fetchUploadBlob(name);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      setState((prev) => ({
        ...prev,
        error: e instanceof Error ? e.message : "下载失败",
      }));
    }
  }, []);

  /** 格式化配额显示。 */
  const formatQuota = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }, []);

  /** 计算配额使用百分比。 */
  const quotaPercent = state.quota
    ? (state.quota.used_bytes / state.quota.limit_bytes) * 100
    : 0;

  return {
    ...state,
    refresh,
    upload,
    deleteFile,
    getDownloadUrl,
    downloadFile,
    formatQuota,
    quotaPercent,
  };
}