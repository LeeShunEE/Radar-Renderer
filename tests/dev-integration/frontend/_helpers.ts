/**
 * dev-integration 前端共享测试助手。
 *
 * 集成测试不 mock api-client，真实 fetch 经 MSW 拦截。MSW 多数受保护端点要求
 * Bearer token（无则返回 401），故大多数链路测试需先 seedAuth() 注入 token，
 * 让 api-client 的 authFetch 自动带上 Authorization。
 *
 * MSW 生命周期与内存态由全局 setup.integration.ts 管理（listen/reset/close +
 * resetMockState）；本助手只负责 token / localStorage 的注入与清理。
 */
import { setTokens, clearTokens } from "@/lib/api-client";

/** 注入 mock token，使后续 authFetch 携带 Bearer（MSW 受保护端点前提）。 */
export function seedAuth(
  access = "mock-access-token",
  refresh = "mock-refresh-token",
): void {
  setTokens(access, refresh);
}

/** 清理 token 与 localStorage（在每个测试文件的 afterEach 调用）。 */
export function resetAuth(): void {
  clearTokens();
  localStorage.clear();
}
