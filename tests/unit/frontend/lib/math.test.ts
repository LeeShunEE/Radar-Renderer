/**
 * math.ts 单元测试：八边形角度计算、雷达多边形、网格环、标签位置。
 */
import { describe, it, expect } from "vitest";
import {
  getOctagonPoint,
  getRadarPolygonPoints,
  getGridRingPoints,
  getLabelPosition,
  getRadarLabelAnchor,
} from "@/lib/math";

describe("getOctagonPoint", () => {
  it("index 0 yields top (angle -π/2)", () => {
    const { x, y } = getOctagonPoint(0, 100, 0, 0);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(-100, 5);
  });
  it("index 2 yields right (angle 0)", () => {
    const { x, y } = getOctagonPoint(2, 100, 0, 0);
    expect(x).toBeCloseTo(100, 5);
    expect(y).toBeCloseTo(0, 5);
  });
  it("index 4 yields bottom (angle π/2)", () => {
    const { x, y } = getOctagonPoint(4, 100, 0, 0);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(100, 5);
  });
  it("respects center offset", () => {
    const { x, y } = getOctagonPoint(0, 50, 100, 200);
    expect(x).toBeCloseTo(100, 5);
    expect(y).toBeCloseTo(150, 5);
  });
});

describe("getRadarPolygonPoints", () => {
  it("converts values to polygon string", () => {
    const pts = getRadarPolygonPoints([100, 50, 0], 200, 0, 0);
    const arr = pts.split(" ");
    expect(arr.length).toBe(3);
    // index 0 (100%): radius=200 → y≈-200 (cos(-π/2)≈0)
    const [x0, y0] = arr[0].split(",");
    expect(Number(x0)).toBeCloseTo(0, 10);
    expect(Number(y0)).toBeCloseTo(-200, 5);
    // index 1 (50%): radius=100 → at angle 45°
    expect(arr[1]).toMatch(/^-?\d+\.?\d*e?-?\d*,-?\d+\.?\d*e?-?\d*$/);
  });
});

describe("getGridRingPoints", () => {
  it("ringLevel 1 at maxRadius", () => {
    const pts = getGridRingPoints(1, 200, 0, 0);
    const arr = pts.split(" ");
    expect(arr.length).toBe(8);
  });
  it("ringLevel 0.5 at half radius", () => {
    const pts1 = getGridRingPoints(1, 200, 0, 0);
    const pts05 = getGridRingPoints(0.5, 200, 0, 0);
    // ringLevel 0.5 should have half-radius points
    const [x1, y1] = pts1.split(" ")[0].split(",");
    const [x05, y05] = pts05.split(" ")[0].split(",");
    expect(Number(y05)).toBeCloseTo(Number(y1) / 2, 3);
  });
});

describe("getLabelPosition", () => {
  it("delegates to getOctagonPoint", () => {
    const pos = getLabelPosition(0, 300, 500, 500);
    expect(pos.x).toBeCloseTo(500, 5);
    expect(pos.y).toBeCloseTo(200, 5);
  });
});

describe("getRadarLabelAnchor", () => {
  it("places labels outside radar at correct distance", () => {
    const maxRadius = 200;
    const fontSize = 20;
    const anchor = getRadarLabelAnchor(0, 500, 500, maxRadius, fontSize, fontSize);
    const expectedDist = maxRadius + 30 + Math.max(fontSize, fontSize) * 0.8;
    // top anchor: x=center, y=center - expectedDist
    expect(anchor.x).toBeCloseTo(500, 5);
    expect(anchor.y).toBeCloseTo(500 - expectedDist, 5);
    // yOffset = (attributeFontSize + ratingFontSize) * 0.5 + 6
    expect(anchor.yOffset).toBeCloseTo((fontSize + fontSize) * 0.5 + 6, 5);
  });
});