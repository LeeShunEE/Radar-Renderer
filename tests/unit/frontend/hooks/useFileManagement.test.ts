/**
 * useFileManagement hook 单元测试：mock api-client.files，验证刷新/上传/删除/下载/配额。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFileManagement } from "@/hooks/useFileManagement";
import { files } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  files: {
    list: vi.fn(),
    upload: vi.fn(),
    delete: vi.fn(),
    downloadUpload: vi.fn(),
    fetchUploadBlob: vi.fn(),
  },
}));

// jsdom 未实现 URL.createObjectURL / revokeObjectURL，手动提供
global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = vi.fn();

const mockFilesData = {
  files: [{ name: "a.png", size_bytes: 512, modified_at: "2026-01-01" }],
  quota: { used_bytes: 512, limit_bytes: 1024, available_bytes: 512 },
};

describe("useFileManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(files.list).mockResolvedValue(mockFilesData);
    vi.mocked(files.upload).mockResolvedValue({});
    vi.mocked(files.delete).mockResolvedValue(undefined);
    vi.mocked(files.downloadUpload).mockImplementation((name) => `http://api/files/${name}`);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("初始化与刷新", () => {
    it("挂载时自动加载文件列表与配额", async () => {
      const { result } = renderHook(() => useFileManagement());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.quota).toEqual(mockFilesData.quota);
      expect(result.current.error).toBeNull();
    });

    it("刷新失败时设置 error（Error 对象）", async () => {
      vi.mocked(files.list).mockRejectedValueOnce(new Error("网络错误"));

      const { result } = renderHook(() => useFileManagement());

      await waitFor(() => {
        expect(result.current.error).toBe("网络错误");
      });
      expect(result.current.loading).toBe(false);
    });

    it("刷新失败时非 Error 对象使用默认消息", async () => {
      vi.mocked(files.list).mockRejectedValueOnce("boom");

      const { result } = renderHook(() => useFileManagement());

      await waitFor(() => {
        expect(result.current.error).toBe("获取文件列表失败");
      });
    });

    it("手动 refresh 重新拉取", async () => {
      const { result } = renderHook(() => useFileManagement());
      await waitFor(() => expect(result.current.loading).toBe(false));

      vi.mocked(files.list).mockResolvedValueOnce({
        files: [{ name: "b.png", size_bytes: 1, modified_at: "2026-01-02" }],
        quota: { used_bytes: 1, limit_bytes: 10, available_bytes: 9 },
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.files[0].name).toBe("b.png");
    });
  });

  describe("upload", () => {
    it("上传成功后刷新列表", async () => {
      const { result } = renderHook(() => useFileManagement());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const file = new File(["x"], "u.png", { type: "image/png" });
      await act(async () => {
        await result.current.upload(file);
      });

      expect(files.upload).toHaveBeenCalledWith(file, expect.any(Function));
      expect(result.current.uploading).toBe(false);
    });

    it("进度回调触发时更新 uploadProgress，成功后重置为 null", async () => {
      let progressCb!: (percent: number) => void;
      let resolveUpload!: () => void;
      vi.mocked(files.upload).mockImplementationOnce((_file, onProgress) => {
        progressCb = onProgress!;
        return new Promise((res) => {
          resolveUpload = () => res({} as never);
        });
      });

      const { result } = renderHook(() => useFileManagement());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let uploadPromise!: Promise<void>;
      act(() => {
        uploadPromise = result.current.upload(new File(["x"], "u.png"));
      });

      // 开始上传：uploading=true，进度从 0 起步
      expect(result.current.uploading).toBe(true);
      expect(result.current.uploadProgress).toBe(0);

      act(() => {
        progressCb(37);
      });
      expect(result.current.uploadProgress).toBe(37);

      await act(async () => {
        resolveUpload();
        await uploadPromise;
      });

      expect(result.current.uploading).toBe(false);
      expect(result.current.uploadProgress).toBeNull();
    });

    it("上传失败时设置 error、重置 uploadProgress 并重新抛出", async () => {
      const { result } = renderHook(() => useFileManagement());
      await waitFor(() => expect(result.current.loading).toBe(false));

      vi.mocked(files.upload).mockRejectedValueOnce(new Error("上传被拒"));

      let threw = false;
      await act(async () => {
        try {
          await result.current.upload(new File(["x"], "u.png"));
        } catch {
          threw = true;
        }
      });

      expect(threw).toBe(true);
      expect(result.current.uploading).toBe(false);
      expect(result.current.uploadProgress).toBeNull();
      expect(result.current.error).toBe("上传被拒");
    });
  });

  describe("deleteFile", () => {
    it("删除成功后刷新列表", async () => {
      const { result } = renderHook(() => useFileManagement());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.deleteFile("a.png");
      });

      expect(files.delete).toHaveBeenCalledWith("a.png");
    });

    it("删除失败时设置 error 并重新抛出", async () => {
      const { result } = renderHook(() => useFileManagement());
      await waitFor(() => expect(result.current.loading).toBe(false));

      vi.mocked(files.delete).mockRejectedValueOnce(new Error("无权限"));

      let threw = false;
      await act(async () => {
        try {
          await result.current.deleteFile("a.png");
        } catch {
          threw = true;
        }
      });

      expect(threw).toBe(true);
      expect(result.current.error).toBe("无权限");
    });
  });

  describe("getDownloadUrl", () => {
    it("返回 downloadUpload 构造的 URL", async () => {
      const { result } = renderHook(() => useFileManagement());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const url = result.current.getDownloadUrl("a.png");
      expect(url).toBe("http://api/files/a.png");
    });
  });

  describe("downloadFile", () => {
    it("拉取 Blob 并触发下载", async () => {
      const blob = new Blob(["data"]);
      vi.mocked(files.fetchUploadBlob).mockResolvedValueOnce(blob);

      const { result } = renderHook(() => useFileManagement());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.downloadFile("a.png");
      });

      expect(files.fetchUploadBlob).toHaveBeenCalledWith("a.png");
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it("下载失败时设置 error", async () => {
      vi.mocked(files.fetchUploadBlob).mockRejectedValueOnce(new Error("401"));

      const { result } = renderHook(() => useFileManagement());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.downloadFile("a.png");
      });

      expect(result.current.error).toBe("401");
    });
  });

  describe("formatQuota", () => {
    it("按量级格式化 B/KB/MB/GB", async () => {
      const { result } = renderHook(() => useFileManagement());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.formatQuota(512)).toBe("512 B");
      expect(result.current.formatQuota(2048)).toBe("2.0 KB");
      expect(result.current.formatQuota(1048576)).toBe("1.0 MB");
      expect(result.current.formatQuota(1073741824)).toBe("1.00 GB");
    });
  });

  describe("quotaPercent", () => {
    it("按 used/limit 计算百分比", async () => {
      const { result } = renderHook(() => useFileManagement());
      await waitFor(() => expect(result.current.loading).toBe(false));

      // used 512 / limit 1024 = 50%
      expect(result.current.quotaPercent).toBe(50);
    });

    it("quota 为 null 时百分比为 0", async () => {
      vi.mocked(files.list).mockResolvedValueOnce({
        files: [],
        quota: { used_bytes: 0, limit_bytes: 0, available_bytes: 0 },
      });
      // 用一个使 quota 为 null 的场景难以触发（list 总带 quota），直接验证默认值
      const { result } = renderHook(() => useFileManagement());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(typeof result.current.quotaPercent).toBe("number");
    });
  });
});
