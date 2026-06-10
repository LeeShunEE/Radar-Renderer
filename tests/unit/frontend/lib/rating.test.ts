/**
 * rating.ts 单元测试：评级计算 + 颜色映射。
 */
import { describe, it, expect } from "vitest";
import { calculateRating, getRatingColor } from "@/lib/rating";

describe("calculateRating", () => {
  it("X tier at 200", () => {
    const r = calculateRating(200);
    expect(r.base).toBe("X");
    expect(r.modifier).toBe("");
    expect(r.full).toBe("X");
  });
  it("SSS tier at 95", () => {
    const r = calculateRating(95);
    expect(r.base).toBe("SSS");
    expect(r.modifier).toBe("");
  });
  it("SS tier at 90", () => {
    const r = calculateRating(90);
    expect(r.base).toBe("SS");
    expect(r.modifier).toBe("");
  });
  it("S tier at 85 (minimum) gets -- modifier", () => {
    const r = calculateRating(85);
    expect(r.base).toBe("S");
    expect(r.modifier).toBe("--");
    expect(r.full).toBe("S--");
  });
  it("S tier at 89 (near max) gets ++ modifier", () => {
    const r = calculateRating(89);
    expect(r.base).toBe("S");
    expect(r.modifier).toBe("++");
  });
  it("A tier at 75 with modifier", () => {
    const r = calculateRating(75);
    expect(r.base).toBe("A");
    expect(r.modifier).toBe("--");
    expect(r.full).toBe("A--");
  });
  it("A tier near upper bound", () => {
    const r = calculateRating(84);
    expect(r.base).toBe("A");
    expect(r.modifier).toBe("++");
  });
  it("B tier at 60", () => {
    const r = calculateRating(60);
    expect(r.base).toBe("B");
    expect(r.modifier).toBe("--");
  });
  it("C tier at 45", () => {
    const r = calculateRating(45);
    expect(r.base).toBe("C");
  });
  it("D tier at 30", () => {
    const r = calculateRating(30);
    expect(r.base).toBe("D");
  });
  it("E tier at 15", () => {
    const r = calculateRating(15);
    expect(r.base).toBe("E");
  });
  it("F tier at 0", () => {
    const r = calculateRating(0);
    expect(r.base).toBe("F");
    expect(r.modifier).toBe("");
  });
  it("F tier below 0", () => {
    const r = calculateRating(-10);
    expect(r.base).toBe("F");
  });
  it("mid-tier value gets correct modifier bucket", () => {
    // A tier range is 75–85; 80 is middle → ""
    const r = calculateRating(80);
    expect(r.base).toBe("A");
    expect(r.modifier).toBe("");
  });
});

describe("getRatingColor", () => {
  it("returns color for each tier", () => {
    expect(getRatingColor({ base: "X", modifier: "", full: "X" })).toBe("#e040fb");
    expect(getRatingColor({ base: "SSS", modifier: "", full: "SSS" })).toBe("#ff6b6b");
    expect(getRatingColor({ base: "F", modifier: "", full: "F" })).toBe("#868e96");
  });
  it("fallback for unknown base", () => {
    expect(getRatingColor({ base: "Unknown", modifier: "", full: "Unknown" })).toBe("#868e96");
  });
});