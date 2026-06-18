/**
 * ConfigPersistencePanel 单元测试：保存/加载/删除、文件导入导出、校验错误。
 * useSavedConfigs 与 shadcn Select 用 mock，confirm/URL 打桩。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfigPersistencePanel } from "@/components/editor/ConfigPersistencePanel";
import { makeMultiPageConfig } from "./_fixtures";

const sc = vi.hoisted(() => ({
  savedNames: [] as string[],
  saveConfig: vi.fn(() => ({ ok: true })) as any,
  loadConfig: vi.fn(() => null) as any,
  deleteConfig: vi.fn(),
  hasName: vi.fn(() => false),
}));

vi.mock("@/hooks/useSavedConfigs", () => ({ useSavedConfigs: () => sc }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      data-testid="select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectValue: ({ placeholder }: any) => <option value="">{placeholder}</option>,
}));
vi.spyOn(window, "confirm").mockReturnValue(true);
vi.stubGlobal("URL", {
  ...URL,
  createObjectURL: vi.fn(() => "blob:fake"),
  revokeObjectURL: vi.fn(),
});

const currentConfig = makeMultiPageConfig(2);

beforeEach(() => {
  sc.savedNames = [];
  sc.saveConfig = vi.fn(() => ({ ok: true }));
  sc.loadConfig = vi.fn(() => null);
  sc.deleteConfig = vi.fn();
  sc.hasName = vi.fn(() => false);
});

describe("ConfigPersistencePanel", () => {
  it("渲染标题与保存按钮（空名时禁用）", () => {
    render(<ConfigPersistencePanel currentConfig={currentConfig} onLoadConfig={vi.fn()} />);
    expect(screen.getByText("配置存档")).toBeInTheDocument();
    expect(screen.getByText("保存")).toBeDisabled();
  });

  it("输入名称后保存成功显示反馈", async () => {
    render(<ConfigPersistencePanel currentConfig={currentConfig} onLoadConfig={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("输入配置名称"), {
      target: { value: "我的配置" },
    });
    fireEvent.click(screen.getByText("保存"));
    expect(sc.saveConfig).toHaveBeenCalledWith("我的配置", currentConfig);
    await waitFor(() => {
      expect(screen.getByText("已保存!")).toBeInTheDocument();
    });
  });

  it("保存失败（重名）显示错误", () => {
    sc.saveConfig = vi.fn(() => ({ ok: false, error: "名称已存在" }));
    render(<ConfigPersistencePanel currentConfig={currentConfig} onLoadConfig={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("输入配置名称"), {
      target: { value: "dup" },
    });
    fireEvent.click(screen.getByText("保存"));
    expect(screen.getByText("名称已存在")).toBeInTheDocument();
  });

  it("hasName 为 true 时显示覆盖提示", () => {
    sc.hasName = vi.fn(() => true);
    render(<ConfigPersistencePanel currentConfig={currentConfig} onLoadConfig={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("输入配置名称"), {
      target: { value: "x" },
    });
    expect(screen.getByText(/已存在同名配置/)).toBeInTheDocument();
  });

  it("选择已存配置并加载 → onLoadConfig", () => {
    const loaded = makeMultiPageConfig(3);
    sc.savedNames = ["cfg1"];
    sc.loadConfig = vi.fn(() => loaded);
    const onLoadConfig = vi.fn();
    render(
      <ConfigPersistencePanel currentConfig={currentConfig} onLoadConfig={onLoadConfig} />,
    );
    fireEvent.change(screen.getByTestId("select"), { target: { value: "cfg1" } });
    fireEvent.click(screen.getByText("加载"));
    expect(sc.loadConfig).toHaveBeenCalledWith("cfg1");
    expect(onLoadConfig).toHaveBeenCalledWith(loaded);
  });

  it("删除（confirm=true）→ deleteConfig", () => {
    sc.savedNames = ["cfg1"];
    render(
      <ConfigPersistencePanel currentConfig={currentConfig} onLoadConfig={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("select"), { target: { value: "cfg1" } });
    fireEvent.click(screen.getByText("删除"));
    expect(sc.deleteConfig).toHaveBeenCalledWith("cfg1");
  });

  it("导出到文件不抛错", () => {
    render(<ConfigPersistencePanel currentConfig={currentConfig} onLoadConfig={vi.fn()} />);
    expect(() => fireEvent.click(screen.getByText("导出到文件"))).not.toThrow();
  });

  it("从文件导入合法配置 → onLoadConfig", async () => {
    const onLoadConfig = vi.fn();
    const { container } = render(
      <ConfigPersistencePanel currentConfig={currentConfig} onLoadConfig={onLoadConfig} />,
    );
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const json = JSON.stringify(makeMultiPageConfig(2));
    fireEvent.change(fileInput, {
      target: { files: [new File([json], "c.json", { type: "application/json" })] },
    });
    await waitFor(() => {
      expect(onLoadConfig).toHaveBeenCalled();
    });
  });

  it("导入非法 JSON 显示错误", async () => {
    const { container } = render(
      <ConfigPersistencePanel currentConfig={currentConfig} onLoadConfig={vi.fn()} />,
    );
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(["{ not json"], "bad.json")] },
    });
    await waitFor(() => {
      expect(screen.getByText(/导入失败/)).toBeInTheDocument();
    });
  });
});
