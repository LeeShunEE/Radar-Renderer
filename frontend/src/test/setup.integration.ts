/**
 * 前端集成测试全局 setup：MSW 生命周期。
 *
 * 在所有集成测试前后自动管理 MSW server（listen / reset / close），
 * 免去每个测试文件手动调用 setupMsw()。
 */
import { beforeAll, afterEach, afterAll } from "vitest";
import { mswServer, resetMockState } from "./msw-server";

// jsdom 的 Blob 未实现 .stream()，而 MSW 经 undici 处理 Blob 响应体（文件下载链路）
// 时会调用它，抛 "object.stream is not a function" 致下载相关集成测试全挂。
// 补一个基于 arrayBuffer 的 ReadableStream 实现（仅在缺失时打补丁）。
if (typeof Blob.prototype.stream !== "function") {
  Blob.prototype.stream = function (this: Blob): ReadableStream<Uint8Array> {
    // 箭头函数捕获外层 this（Blob），避免 const blob = this 触发 no-this-alias
    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        controller.enqueue(new Uint8Array(await this.arrayBuffer()));
        controller.close();
      },
    });
  };
}

beforeAll(() => mswServer.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  mswServer.resetHandlers();
  resetMockState();
});
afterAll(() => mswServer.close());
