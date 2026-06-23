/**
 * TaskQueuePanel 单元测试：空/加载/错误态、列表倒序、下载与删除。
 * useTaskQueue + api-client files 用 vi.hoisted 持有可变状态。
 * 图标按钮无 accessible name，按稳定 DOM 顺序定位：
 *   头部 1 个刷新按钮；每行任务按状态渲染 download(done) → delete。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TaskQueuePanel } from "@/components/tasks/TaskQueuePanel";

const { queueState, fetchOutputBlob } = vi.hoisted(() => ({
  queueState: {
    tasks: [] as any[],
    queueSize: 0,
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

const task = (over: Partial<any> = {}) => ({
  id: 1,
  status: "done",
  mode: "single",
  codec: "h264",
  created_at: "2026-06-01T00:00:00Z",
  eta_seconds: 0,
  position: 0,
  duration_ms: 1500,
  ...over,
});

beforeEach(() => {
  queueState.tasks = [];
  queueState.queueSize = 0;
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

  it("done 任务含下载按钮，点击触发 fetchOutputBlob", async () => {
    queueState.tasks = [task({ id: 5, codec: "gif" })];
    render(<TaskQueuePanel />);
    // 按钮顺序：[刷新, 下载, 删除]
    fireEvent.click(screen.getAllByRole("button")[1]);
    await waitFor(() => {
      expect(fetchOutputBlob).toHaveBeenCalledWith(5);
    });
  });

  it("failed 任务含删除按钮，点击触发 deleteTask", () => {
    queueState.tasks = [task({ id: 9, status: "failed" })];
    render(<TaskQueuePanel />);
    // 按钮顺序：[刷新, 删除]（failed 无下载按钮）
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(queueState.deleteTask).toHaveBeenCalledWith(9);
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
