/**
 * MSW 2.x 服务端 worker（Node 环境）——用于 vitest 单元/集成测试。
 *
 * 在测试 setup 中调用 setupServer()，自动拦截 fetch 请求。
 */
import { setupServer } from "msw/node";
import { handlers, resetMockState } from "./msw-handlers";

export const mswServer = setupServer(...handlers);
export { resetMockState };
