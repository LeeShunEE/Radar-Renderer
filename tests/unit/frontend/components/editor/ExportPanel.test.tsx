/**
 * ExportPanel 单元测试：模式切换、服务端/本地状态文案、提交渲染与取消。
 * useServerRender / useLocalRender 用 vi.hoisted 持有可变状态，按用例改写。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportPanel } from "@/components/editor/ExportPanel";
import { makePage, makeMultiPageConfig } from "./_fixtures";

const { serverState, localState } = vi.hoisted(() => ({
  serverState: {
    status: "idle" as string,
    currentTask: null as null | { position: number; eta_seconds: number },
    error: null as string | null,
    submitRender: vi.fn(),
    cancelRender: vi.fn(),
  },
  localState: {
    rendering: false,
    progress: 0,
    error: null as string | null,
    startLocalRender: vi.fn(),
    cancel: vi.fn(),
  },
}));

vi.mock("@/hooks/useServerRender", () => ({ useServerRender: () => serverState }));
vi.mock("@/hooks/useLocalRender", () => ({ useLocalRender: () => localState }));

const props = makePage();
const config = makeMultiPageConfig(3);

beforeEach(() => {
  serverState.status = "idle";
  serverState.currentTask = null;
  serverState.error = null;
  serverState.submitRender = vi.fn();
  serverState.cancelRender = vi.fn();
  localState.rendering = false;
  localState.progress = 0;
  localState.error = null;
  localState.startLocalRender = vi.fn();
  localState.cancel = vi.fn();
});

describe("ExportPanel", () => {
  it("默认服务端模式渲染单页导出按钮", () => {
    render(<ExportPanel props={props} config={config} />);
    expect(screen.getByText("导出当前页 MP4")).toBeInTheDocument();
    expect(screen.getByText("导出全部 MP4")).toBeInTheDocument(); // 3 页
  });

  it("切换到本地模式渲染 WebM 按钮 + 限制提示", () => {
    render(<ExportPanel props={props} config={config} />);
    fireEvent.click(screen.getByText("本地浏览器"));
    expect(screen.getByText(/本地渲染仅支持 WebM/)).toBeInTheDocument();
    expect(screen.getByText("导出当前页 WebM")).toBeInTheDocument();
  });

  it("服务端排队中显示位置与预计秒数", () => {
    serverState.status = "queued";
    serverState.currentTask = { position: 2, eta_seconds: 30 };
    render(<ExportPanel props={props} config={config} />);
    expect(screen.getByText(/排队中/)).toBeInTheDocument();
    expect(screen.getByText(/第 2 位/)).toBeInTheDocument();
  });

  it("服务端失败显示错误文案", () => {
    serverState.status = "failed";
    serverState.error = "boom";
    render(<ExportPanel props={props} config={config} />);
    expect(screen.getByText(/失败：boom/)).toBeInTheDocument();
  });

  it("点击单页 MP4 → submitRender(single,h264)", () => {
    render(<ExportPanel props={props} config={config} />);
    fireEvent.click(screen.getByText("导出当前页 MP4"));
    const [renderType, codec] = serverState.submitRender.mock.calls.at(-1)!;
    expect(renderType).toBe("single");
    expect(codec).toBe("h264");
  });

  it("点击全部 MP4 → submitRender(multi) 传 config", () => {
    render(<ExportPanel props={props} config={config} />);
    fireEvent.click(screen.getByText("导出全部 MP4"));
    const [renderType, , inputProps] = serverState.submitRender.mock.calls.at(-1)!;
    expect(renderType).toBe("multi");
    expect(inputProps).toEqual({ config });
  });

  it("渲染中显示取消按钮并触发 cancelRender", () => {
    serverState.status = "rendering";
    render(<ExportPanel props={props} config={config} />);
    fireEvent.click(screen.getByText("取消任务"));
    expect(serverState.cancelRender).toHaveBeenCalled();
  });

  it("本地模式点击触发 startLocalRender", () => {
    render(<ExportPanel props={props} config={config} />);
    fireEvent.click(screen.getByText("本地浏览器"));
    fireEvent.click(screen.getByText("导出当前页 WebM"));
    expect(localState.startLocalRender).toHaveBeenCalledWith(props, config);
  });

  it("本地渲染中按钮显示「渲染中...」并出现取消按钮", () => {
    localState.rendering = true;
    localState.progress = 42;
    render(<ExportPanel props={props} config={config} />);
    fireEvent.click(screen.getByText("本地浏览器"));
    expect(screen.getByText(/本地渲染中/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("取消渲染"));
    expect(localState.cancel).toHaveBeenCalled();
  });
});
