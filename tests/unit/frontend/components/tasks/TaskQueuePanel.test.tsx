/**
 * TaskQueuePanel 单元测试：空/加载/错误态、列表倒序、下载与删除。
 * useTaskQueue + api-client files 用 vi.hoisted 持有可变状态。
 * 图标按钮无 accessible name，按稳定 DOM 顺序定位：
 *   头部 1 个刷新按钮；每行任务按状态渲染 download(done) → delete。
 * 删除按钮改为带确认 Dialog，需点击确认按钮才触发 deleteTask。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TaskQueuePanel } from "@/components/tasks/TaskQueuePanel";

const { queueState, fetchOutputBlob } = vi.hoisted(() => ({
  queueState: {
    tasks: [] as any[],
    queueSize: 0,
    avgFps: null as number | null,
    loading: false,
    error: null as string | null,
    refreshTasks: vi.fn(),
    deleteTask: vi.fn(),
  },
  fetchOutputBlob: vi.fn(),
}));

vi.mock("@/hooks/useTaskQueue", () => ({ useTaskQueue: () => queueState }));
vi.mock("@/lib/api-client", () => ({ files: { fetchOutputBlob } }));
// jsdom 未实现 URL.createObjectURL
vi.stubGlobal("URL", {
  ...URL,
  createObjectURL: vi.fn(() => "blob:fake"),
  revokeObjectURL: vi.fn(),
});

// Mock ConfirmDialog 组件以避免 @base-ui/react/dialog 导入问题
vi.mock("@/components/ui/dialog", () => ({
  ConfirmDialog: ({ open, onOpenChange, title, description, confirmLabel, danger, onConfirm }: any) => (
    open ? (
      <div data-testid="confirm-dialog">
        <h2 data-testid="dialog-title">{title}</h2>
        <p data-testid="dialog-description">{description}</p>
        <button data-testid="dialog-cancel" onClick={() => onOpenChange(false)}>取消</button>
        <button data-testid="dialog-confirm" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    ) : null
  ),
}));

const task = (over: Partial<any> = {}) => ({
  id: 1,
  status: "done",
  mode: "single",
  codec: "h264",
  created_at: "2026-06-01T00:00:00Z",
  eta_seconds: 0,
  position: 0,
  duration_ms: 1500,
  file_expired: false,
  output_exists: true,
  ...over,
});

beforeEach(() => {
  queueState.tasks = [];
  queueState.queueSize = 0;
  queueState.avgFps = null;
  queueState.loading = false;
  queueState.error = null;
  queueState.refreshTasks = vi.fn();
  queueState.deleteTask = vi.fn();
  fetchOutputBlob.mockReset();
  fetchOutputBlob.mockResolvedValue(new Blob(["x"]));
});

describe("TaskQueuePanel", () => {
  it("无任务时显示占位", () => {
    render(<TaskQueuePanel />);
    expect(screen.getByText("暂无渲染任务")).toBeInTheDocument();
  });

  it("加载中且无任务显示「加载中...」", () => {
    queueState.loading = true;
    render(<TaskQueuePanel />);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("显示错误文案", () => {
    queueState.error = "网络错误";
    render(<TaskQueuePanel />);
    expect(screen.getByText("网络错误")).toBeInTheDocument();
  });

  it("显示队列待渲染数量", () => {
    queueState.queueSize = 3;
    render(<TaskQueuePanel />);
    expect(screen.getByText("队列中 3 个任务待渲染")).toBeInTheDocument();
  });

  it("刷新按钮（头部，第 0 个按钮）触发 refreshTasks", () => {
    render(<TaskQueuePanel />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(queueState.refreshTasks).toHaveBeenCalled();
  });

  it("有 avgFps 时显示平均渲速", () => {
    queueState.avgFps = 45.5;
    render(<TaskQueuePanel />);
    expect(screen.getByText(/平均渲速 45.5 帧\/秒/)).toBeInTheDocument();
  });

  it("无 avgFps 时显示统计中", () => {
    render(<TaskQueuePanel />);
    expect(screen.getByText("平均渲速 统计中")).toBeInTheDocument();
  });

  it("done 任务含下载按钮，点击触发 fetchOutputBlob", async () => {
    queueState.avgFps = 60;
    queueState.tasks = [task({ id: 5, codec: "gif" })];
    render(<TaskQueuePanel />);
    // 按钮顺序：[刷新, 下载, 删除]（刷新按钮在头部右侧，avgFps 后）
    fireEvent.click(screen.getAllByRole("button")[1]);
    await waitFor(() => {
      expect(fetchOutputBlob).toHaveBeenCalledWith(5);
    });
  });

  it("done 任务 output_exists=false 时不显示下载按钮", () => {
    queueState.tasks = [task({ id: 5, status: "done", output_exists: false })];
    render(<TaskQueuePanel />);
    // 只有刷新按钮和删除按钮（没有下载按钮）
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2);
  });

  it("file_expired=true 时显示「产物已清理」提示", () => {
    queueState.tasks = [task({ id: 5, status: "done", file_expired: true, output_exists: false })];
    render(<TaskQueuePanel />);
    expect(screen.getByText("产物已清理")).toBeInTheDocument();
  });

  it("failed 任务含删除按钮，点击打开 Dialog，确认后触发 deleteTask", async () => {
    queueState.tasks = [task({ id: 9, status: "failed" })];
    render(<TaskQueuePanel />);
    // 按钮顺序：[刷新, 删除]（failed 无下载按钮）
    fireEvent.click(screen.getAllByRole("button")[1]);
    // Dialog 打开
    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    });
    // 点击确认按钮（Dialog 内的删除按钮）
    const confirmButton = screen.getByTestId("dialog-confirm");
    fireEvent.click(confirmButton);
    await waitFor(() => {
      expect(queueState.deleteTask).toHaveBeenCalledWith(9);
    });
  });

  it("running 任务显示进度条 + 帧数 + 剩余时间", () => {
    queueState.tasks = [
      task({
        id: 7,
        status: "running",
        duration_ms: null,
        rendered_frames: 40,
        total_frames: 200,
        eta_seconds: 90,
      }),
    ];
    render(<TaskQueuePanel />);
    expect(screen.getByText(/40\/200/)).toBeInTheDocument();
    expect(screen.getByText(/剩 1 分 30 秒/)).toBeInTheDocument();
  });
});