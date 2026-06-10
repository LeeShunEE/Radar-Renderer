/**
 * global-override.ts 单元测试：路径访问/设置（不可变）+ 全局覆盖应用。
 */
import { describe, it, expect } from "vitest";
import { getByPath, setByPath, applyGlobalOverride, ALL_OVERRIDE_FIELDS } from "@/lib/global-override";
import type { RadarVideoProps, GlobalOverrideConfig } from "@/types/radar";

describe("getByPath", () => {
  it("gets nested value", () => {
    const obj = { theme: { backgroundColor: "#000" } };
    expect(getByPath(obj, "theme.backgroundColor")).toBe("#000");
  });
  it("returns undefined for missing path", () => {
    const obj = { theme: {} };
    expect(getByPath(obj, "theme.backgroundColor")).toBeUndefined();
  });
  it("returns undefined for null intermediate", () => {
    const obj = { theme: null };
    expect(getByPath(obj, "theme.backgroundColor")).toBeNull();
  });
});

describe("setByPath", () => {
  it("sets nested value immutably", () => {
    const obj = { theme: { backgroundColor: "#000" } };
    const next = setByPath(obj, "theme.backgroundColor", "#fff");
    expect(next.theme.backgroundColor).toBe("#fff");
    expect(obj.theme.backgroundColor).toBe("#000"); // original unchanged
  });
  it("clones intermediate objects", () => {
    const obj = { theme: { gridColor: "#111", backgroundColor: "#000" } };
    const next = setByPath(obj, "theme.backgroundColor", "#fff");
    expect(next.theme.gridColor).toBe("#111"); // sibling preserved
    expect(obj.theme).not.toBe(next.theme); // intermediate cloned
  });
  it("handles array clones", () => {
    const obj = { arr: [1, 2, 3] };
    const next = setByPath(obj, "arr.1", 99);
    expect(next.arr).toEqual([1, 99, 3]);
    expect(obj.arr).toEqual([1, 2, 3]);
  });
});

describe("applyGlobalOverride", () => {
  const basePage: RadarVideoProps = {
    characterName: "Hero",
    silhouetteSrc: "",
    attributes: [],
    theme: { backgroundColor: "#000", gridColor: "#111" },
    animation: { fillDuration: 30 },
    font: { characterName: 126 },
    layout: { radarCX: 960 },
  } as unknown as RadarVideoProps;

  it("returns page unchanged when override undefined", () => {
    const result = applyGlobalOverride(basePage, undefined);
    expect(result).toBe(basePage);
  });

  it("skips when enabled[field.path] false", () => {
    const override: GlobalOverrideConfig = {
      enabled: { "theme.backgroundColor": false },
      values: { theme: { backgroundColor: "#fff" } },
    };
    const result = applyGlobalOverride(basePage, override);
    expect(result.theme.backgroundColor).toBe("#000");
  });

  it("skips when overrideIgnored blocks", () => {
    const pageIgnored = { ...basePage, overrideIgnored: { "theme.backgroundColor": true } };
    const override: GlobalOverrideConfig = {
      enabled: { "theme.backgroundColor": true },
      values: { theme: { backgroundColor: "#fff" } },
    };
    const result = applyGlobalOverride(pageIgnored, override);
    expect(result.theme.backgroundColor).toBe("#000");
  });

  it("skips when value undefined", () => {
    const override: GlobalOverrideConfig = {
      enabled: { "theme.backgroundColor": true },
      values: { theme: {} },
    };
    const result = applyGlobalOverride(basePage, override);
    expect(result.theme.backgroundColor).toBe("#000");
  });

  it("applies when enabled + not ignored + value defined", () => {
    const override: GlobalOverrideConfig = {
      enabled: { "theme.backgroundColor": true },
      values: { theme: { backgroundColor: "#fff" } },
    };
    const result = applyGlobalOverride(basePage, override);
    expect(result.theme.backgroundColor).toBe("#fff");
    expect(basePage.theme.backgroundColor).toBe("#000"); // original unchanged
  });

  it("applies multiple fields", () => {
    const override: GlobalOverrideConfig = {
      enabled: { "theme.backgroundColor": true, "layout.radarCX": true },
      values: { theme: { backgroundColor: "#abc" }, layout: { radarCX: 500 } },
    };
    const result = applyGlobalOverride(basePage, override);
    expect(result.theme.backgroundColor).toBe("#abc");
    expect(result.layout.radarCX).toBe(500);
  });
});

describe("ALL_OVERRIDE_FIELDS", () => {
  it("is non-empty", () => {
    expect(ALL_OVERRIDE_FIELDS.length).toBeGreaterThan(0);
  });
  it("each field has path and label", () => {
    for (const f of ALL_OVERRIDE_FIELDS) {
      expect(f.path).toBeTruthy();
      expect(f.label).toBeTruthy();
    }
  });
});