/**
 * FieldFocusContext 单元测试：focus 的 tab 推断、opts 分支、DOM 高亮。
 * requestAnimationFrame / scrollIntoView 在 jsdom 需打桩。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import {
  FieldFocusProvider,
  useFieldFocus,
} from "@/components/editor/FieldFocusContext";

// rAF 双层嵌套需立即执行，否则 highlight 永不触发
beforeEach(() => {
  vi.stubGlobal(
    "requestAnimationFrame",
    (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    },
  );
  // jsdom 未实现 scrollIntoView，调用会抛错
  Element.prototype.scrollIntoView = vi.fn();
});

let capturedFocus: ((ids: string[], opts?: any) => void) | null = null;
const Probe = () => {
  const { focus } = useFieldFocus();
  capturedFocus = focus;
  return null;
};

describe("FieldFocusContext", () => {
  beforeEach(() => {
    capturedFocus = null;
  });

  it("无 Provider 时 useFieldFocus 返回安全 noop（不抛错）", () => {
    expect(() => render(<Probe />)).not.toThrow();
    expect(typeof capturedFocus).toBe("function");
    expect(() => capturedFocus!(["page:0:x"])).not.toThrow();
  });

  it("focus 带 pageIndex 调用 setActivePageIndex + setPageExpanded", () => {
    const setActivePageIndex = vi.fn();
    const setPageExpanded = vi.fn();
    render(
      <FieldFocusProvider
        setActivePageIndex={setActivePageIndex}
        setPageExpanded={setPageExpanded}
      >
        <Probe />
      </FieldFocusProvider>,
    );
    capturedFocus!(["page:1:x"], { pageIndex: 1 });
    expect(setActivePageIndex).toHaveBeenCalledWith(1);
    expect(setPageExpanded).toHaveBeenCalledWith(1, true);
  });

  it("comparison: 前缀 → setActiveTab('comparison')", () => {
    const setActiveTab = vi.fn();
    render(
      <FieldFocusProvider
        setActivePageIndex={vi.fn()}
        setPageExpanded={vi.fn()}
        setActiveTab={setActiveTab}
      >
        <Probe />
      </FieldFocusProvider>,
    );
    capturedFocus!(["comparison:0:delayFrames"]);
    expect(setActiveTab).toHaveBeenCalledWith("comparison");
  });

  it("page: 前缀 → setActiveTab('pages')", () => {
    const setActiveTab = vi.fn();
    render(
      <FieldFocusProvider
        setActivePageIndex={vi.fn()}
        setPageExpanded={vi.fn()}
        setActiveTab={setActiveTab}
      >
        <Probe />
      </FieldFocusProvider>,
    );
    capturedFocus!(["page:0:x"]);
    expect(setActiveTab).toHaveBeenCalledWith("pages");
  });

  it("未知前缀不调用 setActiveTab", () => {
    const setActiveTab = vi.fn();
    render(
      <FieldFocusProvider
        setActivePageIndex={vi.fn()}
        setPageExpanded={vi.fn()}
        setActiveTab={setActiveTab}
      >
        <Probe />
      </FieldFocusProvider>,
    );
    capturedFocus!(["unknown:x"]);
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it("高亮：focus 命中 data-field-id 元素并加 ring-2 class", () => {
    render(
      <FieldFocusProvider setActivePageIndex={vi.fn()} setPageExpanded={vi.fn()}>
        <div data-field-id="page:0:animation.fillDuration">x</div>
        <Probe />
      </FieldFocusProvider>,
    );
    capturedFocus!(["page:0:animation.fillDuration"]);
    const el = document.querySelector('[data-field-id="page:0:animation.fillDuration"]')!;
    expect(el.classList.contains("ring-2")).toBe(true);
  });

  it("重复 focus 同一 id 触发 clearTimeout 分支（不崩溃）", () => {
    render(
      <FieldFocusProvider setActivePageIndex={vi.fn()} setPageExpanded={vi.fn()}>
        <div data-field-id="page:0:y">y</div>
        <Probe />
      </FieldFocusProvider>,
    );
    expect(() => {
      capturedFocus!(["page:0:y"]);
      capturedFocus!(["page:0:y"]);
    }).not.toThrow();
  });
});
