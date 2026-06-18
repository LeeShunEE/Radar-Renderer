/**
 * FileManagerPanel dev-integration 测试。
 *
 * 链路：FileManagerPanel → useFileManagement → api-client(files) → MSW。render 真实组件，
 * 验证文件列表/配额出现、上传→列表刷新、删除→列表更新全链路。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { FileManagerPanel } from "@/components/files/FileManagerPanel";
import { seedAuth, resetAuth } from "../../_helpers";

const mockAnchorClick = vi.fn();
const originalCreateElement = document.createElement.bind(document);

beforeEach(() => {
  seedAuth();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "a") {
      return { href: "", download: "", click: mockAnchorClick } as unknown as HTMLAnchorElement;
    }
    return originalCreateElement(tag);
  });
});

afterEach(() => {
  resetAuth();
  vi.restoreAllMocks();
  mockAnchorClick.mockClear();
});

describe("FileManagerPanel（集成）", () => {
  it("render 后文件列表与配额出现", async () => {
    render(<FileManagerPanel />);

    await waitFor(() => {
      expect(screen.getByText("silhouette.png")).toBeInTheDocument();
    });
    // 配额进度文案出现（已用 / 总量）
    expect(screen.getByText(/已用/)).toBeInTheDocument();
  });

  it("上传文件后列表刷新（新增 uploaded.png）", async () => {
    render(<FileManagerPanel />);
    await waitFor(() => expect(screen.getByText("silhouette.png")).toBeInTheDocument());

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["d"], "my.png", { type: "image/png" })] } });

    await waitFor(() => {
      expect(screen.getByText("uploaded.png")).toBeInTheDocument();
    });
  });

  it("删除文件后列表更新", async () => {
    render(<FileManagerPanel />);
    await waitFor(() => expect(screen.getByText("silhouette.png")).toBeInTheDocument());

    // 删除按钮是行内最后一个 button（上传/刷新按钮在前）
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText("暂无上传文件")).toBeInTheDocument();
    });
  });
});
