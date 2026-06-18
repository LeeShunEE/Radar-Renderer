/**
 * useSavedConfigs hook 单元测试：localStorage 持久化 + MultiPageSchema 校验。
 *
 * MultiPageSchema 字段极多（8 元组 attributes + 完整 theme/animation/font/layout），
 * 构造合法 config 成本高且与 schema 实现耦合；这里 mock MultiPageSchema.safeParse，
 * 按需返回 success/fail，以确定性覆盖 loadConfig 的两个分支。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockSafeParse } = vi.hoisted(() => ({ mockSafeParse: vi.fn() }));

vi.mock("@/types/radar", () => ({
  MultiPageSchema: { safeParse: mockSafeParse },
}));

import { useSavedConfigs } from "@/hooks/useSavedConfigs";
import type { MultiPageConfig } from "@/types/radar";

const STORAGE_KEY = "radar-editor-saved-configs";

const validConfig = { pages: [], musicUrl: "" } as unknown as MultiPageConfig;

describe("useSavedConfigs", () => {
  beforeEach(() => {
    localStorage.clear();
    mockSafeParse.mockReset();
    mockSafeParse.mockImplementation((raw: unknown) => ({
      success: true,
      data: raw,
    }));
  });

  it("初始无数据时 savedNames 为空", () => {
    const { result } = renderHook(() => useSavedConfigs());
    expect(result.current.savedNames).toEqual([]);
  });

  it("readMap 容错损坏的 JSON（返回空 map）", () => {
    localStorage.setItem(STORAGE_KEY, "{not-valid-json");
    const { result } = renderHook(() => useSavedConfigs());
    expect(result.current.savedNames).toEqual([]);
  });

  it("saveConfig 空名称返回错误", () => {
    const { result } = renderHook(() => useSavedConfigs());
    expect(result.current.saveConfig("  ", validConfig)).toEqual({
      ok: false,
      error: "名称不能为空",
    });
  });

  it("saveConfig 写入后出现在 savedNames 且 hasName 为真", () => {
    const { result } = renderHook(() => useSavedConfigs());

    act(() => {
      result.current.saveConfig("cfg-a", validConfig);
    });

    expect(result.current.savedNames).toContain("cfg-a");
    expect(result.current.hasName("cfg-a")).toBe(true);
    expect(result.current.hasName("missing")).toBe(false);
  });

  it("savedNames 按保存时间倒序排列", () => {
    // 预置两条带不同 savedAt 的记录，渲染时 useEffect 自动读取并排序
    const map = {
      older: { name: "older", config: validConfig, savedAt: "2026-01-01T00:00:00Z" },
      newer: { name: "newer", config: validConfig, savedAt: "2026-01-02T00:00:00Z" },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));

    const { result } = renderHook(() => useSavedConfigs());

    expect(result.current.savedNames).toEqual(["newer", "older"]);
  });

  it("writeMap 失败时返回存储空间不足错误", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });

    const { result } = renderHook(() => useSavedConfigs());

    let res: { ok: boolean; error?: string };
    act(() => {
      res = result.current.saveConfig("cfg", validConfig);
    });

    expect(res!).toEqual({ ok: false, error: "保存失败：存储空间不足" });
    setItemSpy.mockRestore();
  });

  it("loadConfig 命中且校验通过返回 parsed data", () => {
    mockSafeParse.mockReturnValueOnce({ success: true, data: validConfig });

    const { result } = renderHook(() => useSavedConfigs());
    act(() => {
      result.current.saveConfig("cfg", validConfig);
    });

    expect(result.current.loadConfig("cfg")).toBe(validConfig);
  });

  it("loadConfig 命中但校验失败时返回原始 raw", () => {
    const raw = { broken: true };
    mockSafeParse.mockReturnValueOnce({ success: false, error: new Error("bad") });

    const { result } = renderHook(() => useSavedConfigs());
    act(() => {
      result.current.saveConfig("cfg", raw as unknown as MultiPageConfig);
    });

    // saveConfig 内部不会校验，仅 loadConfig 时校验；重置 mock 让 loadConfig 命中失败分支
    mockSafeParse.mockReturnValueOnce({ success: false, error: new Error("bad") });
    expect(result.current.loadConfig("cfg")).toEqual(raw);
  });

  it("loadConfig 不存在的名称返回 null", () => {
    const { result } = renderHook(() => useSavedConfigs());
    expect(result.current.loadConfig("nope")).toBeNull();
  });

  it("deleteConfig 移除记录并刷新 savedNames", () => {
    const { result } = renderHook(() => useSavedConfigs());

    act(() => {
      result.current.saveConfig("cfg-a", validConfig);
      result.current.saveConfig("cfg-b", validConfig);
    });
    expect(result.current.savedNames).toHaveLength(2);

    act(() => {
      result.current.deleteConfig("cfg-a");
    });

    expect(result.current.savedNames).toEqual(["cfg-b"]);
    expect(result.current.hasName("cfg-a")).toBe(false);
  });
});
