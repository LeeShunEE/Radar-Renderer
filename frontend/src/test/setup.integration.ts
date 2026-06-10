/**
 * 前端集成测试全局 setup：MSW 生命周期。
 *
 * 在所有集成测试前后自动管理 MSW server（listen / reset / close），
 * 免去每个测试文件手动调用 setupMsw()。
 */
import { beforeAll, afterEach, afterAll } from "vitest";
import { mswServer, resetMockState } from "./msw-server";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  mswServer.resetHandlers();
  resetMockState();
});
afterAll(() => mswServer.close());
