/**
 * Silhouette 组件单元测试。
 *
 * 核心被测：isRemoteSilhouetteSrc 纯函数——判断剪影 src 是"绝对/特殊协议 URL"
 * （http(s): / blob: / data:，应原样交给 <Img>）还是"相对路径"（交给 staticFile）。
 *
 * bug 背景：预览阶段 PreviewPanel 把鉴权上传图本地化为 blob: URL 注入 <Player>，
 * 旧实现 `src.startsWith("http")` 不认 blob:/data:，误丢给 staticFile 路径化，
 * 浏览器最终请求 `<origin>/blob:...`（冒号被编码 %3A）导致 404。
 *
 * 组件级回归：mock remotion 运行时（useCurrentFrame/interpolate/staticFile/Img），
 * 验证 blob URL 原样透传 <Img> 且不触发 staticFile，相对路径则经 staticFile 解析。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// vi.hoisted：mock 引用在 factory 与测试用例间共享同一实例，便于断言调用/入参。
const mocks = vi.hoisted(() => ({
  // staticFile 在"相对路径"分支被调用；mock 出可断言调用/未调用与入参
  staticFile: vi.fn((p: string) => `__STATIC__/${p}`),
  // useCurrentFrame 返回固定帧；interpolate 被整体 mock，帧值仅占位
  useCurrentFrame: vi.fn(() => 30),
  // Img 捕获传入的 src，返回 null 即可（无需真实渲染 <img>，避免在 hoisted factory 造 React 元素）
  Img: vi.fn((): null => null),
}));

vi.mock("remotion", () => ({
  useCurrentFrame: mocks.useCurrentFrame,
  // interpolate 一律返回 1：fadeIn=1（≥0.01，组件不早返回 null）、scale=1、effectiveOpacity 正常
  interpolate: () => 1,
  Easing: { bezier: () => 0 },
  staticFile: mocks.staticFile,
  Img: mocks.Img,
}));

import { Silhouette, isRemoteSilhouetteSrc } from "@/remotion/CharacterSilhouette/Silhouette";
import { Img, staticFile } from "remotion";

describe("isRemoteSilhouetteSrc", () => {
  it("blob: 判为远程（预览注入的鉴权图本地化）", () => {
    expect(isRemoteSilhouetteSrc("blob:https://radar.example.com/f603d0a7-abcd-1234")).toBe(true);
  });

  it("http: / https: 判为远程", () => {
    expect(isRemoteSilhouetteSrc("http://example.com/a.png")).toBe(true);
    expect(isRemoteSilhouetteSrc("https://example.com/api/v1/files/uploads/x.png")).toBe(true);
  });

  it("data: 判为远程（base64 内嵌兼容）", () => {
    expect(isRemoteSilhouetteSrc("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
  });

  it("协议大小写不敏感", () => {
    expect(isRemoteSilhouetteSrc("HTTP://example.com/a.png")).toBe(true);
    expect(isRemoteSilhouetteSrc("HTTPS://example.com/a.png")).toBe(true);
    expect(isRemoteSilhouetteSrc("Blob:https://example.com/x")).toBe(true);
    expect(isRemoteSilhouetteSrc("DATA:image/png;base64,xxx")).toBe(true);
  });

  it("相对路径判为非远程（走 staticFile）", () => {
    expect(isRemoteSilhouetteSrc("silhouettes/hero.png")).toBe(false);
  });

  it("根路径开头判为非远程", () => {
    expect(isRemoteSilhouetteSrc("/static/hero.png")).toBe(false);
  });

  it("服务端改写后的相对路径 _render_tmp/... 判为非远程", () => {
    expect(isRemoteSilhouetteSrc("_render_tmp/abc-token-123/hero.png")).toBe(false);
  });

  it("空串判为非远程", () => {
    expect(isRemoteSilhouetteSrc("")).toBe(false);
  });
});

describe("Silhouette 组件 src 解析回归", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blob: URL 原样透传给 <Img>，不调用 staticFile", () => {
    const blobUrl = "blob:https://radar.example.com/f603d0a7-abcd-1234";
    render(<Silhouette src={blobUrl} opacity={1} delay={0} fadeInDuration={30} />);

    expect(Img).toHaveBeenCalled();
    expect(Img.mock.calls[0][0]).toMatchObject({ src: blobUrl });
    expect(staticFile).not.toHaveBeenCalled();
  });

  it("https URL 原样透传给 <Img>，不调用 staticFile", () => {
    const httpsUrl = "https://cdn.example.com/uploads/x.png";
    render(<Silhouette src={httpsUrl} opacity={1} delay={0} fadeInDuration={30} />);

    expect(Img).toHaveBeenCalled();
    expect(Img.mock.calls[0][0]).toMatchObject({ src: httpsUrl });
    expect(staticFile).not.toHaveBeenCalled();
  });

  it("相对路径经 staticFile 解析后交给 <Img>", () => {
    const rel = "silhouettes/hero.png";
    render(<Silhouette src={rel} opacity={1} delay={0} fadeInDuration={30} />);

    expect(staticFile).toHaveBeenCalledWith(rel);
    expect(Img).toHaveBeenCalled();
    expect(Img.mock.calls[0][0]).toMatchObject({ src: `__STATIC__/${rel}` });
  });
});
