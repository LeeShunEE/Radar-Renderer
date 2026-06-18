/**
 * FileManagerPanel 单元测试：空/加载/错误态、配额与警告、文件列表、删除与下载。
 * useFileManagement 用 vi.hoisted 持有可变状态。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileManagerPanel } from "@/components/files/FileManagerPanel";

const fm = vi.hoisted(() => ({
  state: {
    files: [] as any[],
    quota: null as any,
    loading: false,
    uploading: false,
    error: null as string | null,
    refresh: vi.fn(),
    upload: vi.fn(),
    deleteFile: vi.fn(),
    downloadFile: vi.fn(),
    formatQuota: (n: number) => `${n}B`,
    quotaPercent: 0,
  },
}));

vi.mock("@/hooks/useFileManagement", () => ({ useFileManagement: () => fm.state }));
vi.spyOn(window, "confirm").mockReturnValue(true);

const file = (name: string, size = 100) => ({ name, size_bytes: size });

beforeEach(() => {
  fm.state.files = [];
  fm.state.quota = null;
  fm.state.loading = false;
  fm.state.uploading = false;
  fm.state.error = null;
  fm.state.refresh = vi.fn();
  fm.state.upload = vi.fn();
  fm.state.deleteFile = vi.fn();
  fm.state.downloadFile = vi.fn();
  fm.state.quotaPercent = 0;
});

describe("FileManagerPanel", () => {
  it("无文件时显示占位", () => {
    render(<FileManagerPanel />);
    expect(screen.getByText("暂无上传文件")).toBeInTheDocument();
  });

  it("加载中且无文件显示「加载中...」", () => {
    fm.state.loading = true;
    render(<FileManagerPanel />);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("显示错误文案", () => {
    fm.state.error = "上传失败";
    render(<FileManagerPanel />);
    expect(screen.getByText("上传失败")).toBeInTheDocument();
  });

  it("配额 >= 90% 显示告警", () => {
    fm.state.quota = { used_bytes: 950, limit_bytes: 1000, available_bytes: 50 };
    fm.state.quotaPercent = 95;
    render(<FileManagerPanel />);
    expect(screen.getByText("存储空间即将用尽")).toBeInTheDocument();
  });

  it("渲染文件列表 + 大小", () => {
    fm.state.files = [file("a.png", 2048), file("b.mp3", 4096)];
    render(<FileManagerPanel />);
    expect(screen.getByText("a.png")).toBeInTheDocument();
    expect(screen.getByText("b.mp3")).toBeInTheDocument();
    expect(screen.getByText("2048B")).toBeInTheDocument();
  });

  it("点文件名触发 downloadFile", () => {
    fm.state.files = [file("a.png")];
    render(<FileManagerPanel />);
    fireEvent.click(screen.getByText("a.png"));
    expect(fm.state.downloadFile).toHaveBeenCalledWith("a.png");
  });

  it("点删除按钮（confirm=true）触发 deleteFile", () => {
    fm.state.files = [file("a.png")];
    render(<FileManagerPanel />);
    // 删除按钮是行内最后一个 button
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    expect(fm.state.deleteFile).toHaveBeenCalledWith("a.png");
  });

  it("刷新按钮触发 refresh", () => {
    render(<FileManagerPanel />);
    // 上传 + 刷新两个按钮，刷新在最后
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    expect(fm.state.refresh).toHaveBeenCalled();
  });
});
