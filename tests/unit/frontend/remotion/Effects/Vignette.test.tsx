import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Vignette } from "@/remotion/Effects/Vignette";
import type { RadarTheme } from "@/types/radar";

const theme = (over: Partial<RadarTheme> = {}): RadarTheme => ({
  backgroundColor: "#0b1020", gridColor: "#1e293b", gridFillColor: "#334155",
  gridStrokeColor: "#475569", dotColor: "#38bdf8", highValueDotColor: "#f59e0b",
  labelColor: "#e2e8f0", valueColor: "#facc15", glowColor: "#38bdf8",
  enhanceArrowColor: "#ef4444", weakenArrowColor: "#22c55e", silhouetteOpacity: 0.8,
  vignetteEnabled: true, vignetteBrightness: -60, vignetteCenterX: 50,
  vignetteCenterY: 50, vignetteInnerStop: 30, vignetteOuterStop: 90, ...over,
});

describe("Vignette", () => {
  it("vignetteEnabled=false 时不渲染遮罩", () => {
    const { container } = render(<Vignette theme={theme({ vignetteEnabled: false })} />);
    expect(container.firstChild).toBeNull();
  });

  it("启用时渲染一个 radial-gradient 叠加层", () => {
    const { container } = render(<Vignette theme={theme()} />);
    const el = container.firstChild as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.background).toContain("radial-gradient");
    expect(el.style.background).toContain("50% 50%");
  });
});
