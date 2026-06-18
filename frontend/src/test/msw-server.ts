/**
 * MSW 2.x 服务端 worker（Node 环境）——用于 vitest 单元/集成测试。
 *
 * 在测试 setup 中调用 setupServer()，自动拦截 fetch 请求。
 */
import { setupServer } from "msw/node";
import { handlers, resetMockState } from "./msw-handlers";

// re-export http/HttpResponse：测试文件位于 frontend/ 之外（tests/unit/frontend/），
// 无法直接解析 node_modules 中的 msw；统一从本文件（位于 frontend/src/test/）转出。
export { http, HttpResponse } from "msw";

export const mswServer = setupServer(...handlers);
export { resetMockState };
