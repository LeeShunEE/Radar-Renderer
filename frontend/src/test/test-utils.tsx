/**
 * 测试工具：包裹 AuthProvider + MSW server 生命周期的 renderWithProviders()。
 */
import { ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { mswServer } from "./msw-server";
import { beforeAll, afterEach, afterAll } from "vitest";

/**
 * 在每次测试前启动 MSW、测试后恢复。在 describe/test 文件顶层调用一次。
 */
export function setupMsw() {
  beforeAll(() => mswServer.listen({ onUnhandledRequest: "bypass" }));
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());
}

/**
 * 简易 render wrapper，未来可包裹 AuthProvider 等全局 context。
 */
export function renderWithProviders(
  ui: ReactNode,
  options?: Omit<RenderOptions, "wrapper">,
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
