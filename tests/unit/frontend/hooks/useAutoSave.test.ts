/**
 * useAutoSave hook 单元测试：localStorage 自动保存功能。
 *
 * 测试 saveAuto/loadAuto/clearAuto/getAutoSaveInfo 四个核心 API，
 * 以及标题格式生成逻辑。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useAutoSave } from "@/hooks/useAutoSave";
import type { MultiPageConfig } from "@/types/radar";

const STORAGE_KEY = "radar-editor-auto-save";

const validConfig = { pages: [], musicUrl: "" } as unknown as MultiPageConfig;

describe("useAutoSave", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saveAuto 写入 localStorage 并返回 true", () => {
    const { result } = renderHook(() => useAutoSave());

    let success: boolean;
    act(() => {
      success = result.current.saveAuto(validConfig);
    });

    expect(success!).toBe(true);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const entry = JSON.parse(raw!);
    expect(entry.config).toEqual(validConfig);
    expect(entry.title).toMatch(/^自动保存 - \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("saveAuto 存储失败时返回 false", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });

    const { result } = renderHook(() => useAutoSave());

    let success: boolean;
    act(() => {
      success = result.current.saveAuto(validConfig);
    });

    expect(success!).toBe(false);
    setItemSpy.mockRestore();
  });

  it("loadAuto 无数据时返回 null", () => {
    const { result } = renderHook(() => useAutoSave());
    expect(result.current.loadAuto()).toBeNull();
  });

  it("loadAuto 有数据时返回 config", () => {
    const entry = {
      config: validConfig,
      savedAt: "2026-01-01T00:00:00Z",
      title: "自动保存 - 2026-01-01 00:00",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));

    const { result } = renderHook(() => useAutoSave());
    expect(result.current.loadAuto()).toEqual(validConfig);
  });

  it("loadAuto 容错损坏的 JSON（返回 null）", () => {
    localStorage.setItem(STORAGE_KEY, "{not-valid-json");
    const { result } = renderHook(() => useAutoSave());
    expect(result.current.loadAuto()).toBeNull();
  });

  it("clearAuto 移除 localStorage 记录", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ config: validConfig }));

    const { result } = renderHook(() => useAutoSave());
    act(() => {
      result.current.clearAuto();
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("getAutoSaveInfo 无数据时返回 null", () => {
    const { result } = renderHook(() => useAutoSave());
    expect(result.current.getAutoSaveInfo()).toBeNull();
  });

  it("getAutoSaveInfo 有数据时返回 title 和 savedAt", () => {
    const entry = {
      config: validConfig,
      savedAt: "2026-01-01T12:30:00Z",
      title: "自动保存 - 2026-01-01 12:30",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));

    const { result } = renderHook(() => useAutoSave());
    const info = result.current.getAutoSaveInfo();
    expect(info).toEqual({
      title: "自动保存 - 2026-01-01 12:30",
      savedAt: "2026-01-01T12:30:00Z",
    });
  });

  it("标题格式符合 YYYY-MM-DD HH:MM", () => {
    // Mock Date to get deterministic title
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-25T14:35:00Z"));

    const { result } = renderHook(() => useAutoSave());

    act(() => {
      result.current.saveAuto(validConfig);
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    const entry = JSON.parse(raw!);
    // Note: The title uses local time, so depending on timezone it may differ
    // We just check the format pattern
    expect(entry.title).toMatch(/^自动保存 - \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});