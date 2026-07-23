/**
 * 前端开发环境集成测试 vitest 配置。
 *
 * 独立配置（不 merge unit config），include 仅指向 dev-integration 测试树。
 * 全局 MSW 生命周期通过 setup.integration.ts 管理，集成测试不必各自调用 setupMsw。
 */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts", "./src/test/setup.integration.ts"],
    include: ["../tests/dev-integration/frontend/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // dev-integration 只覆盖「有 HTTP 链路」的数据层（经 MSW 验证 client/hook/context
      // → api-client → 后端 全链路）。容器组件的渲染分支由单元阶段 perFile 60% 把关，
      // 符合 §7.2「单元+集成合计」语义，故不纳入集成 include。
      include: [
        "src/lib/api-client.ts",
        "src/lib/auth-store.ts",
        "src/contexts/**",
        "src/hooks/useFileManagement.ts",
        "src/hooks/usePublicAssets.ts",
        "src/hooks/useServerRender.ts",
        "src/hooks/useTaskPolling.ts",
        "src/hooks/useTaskQueue.ts",
        "src/hooks/useUploadObjectUrls.ts",
      ],
      exclude: [
        "src/types/**",
        "src/test/**",
        "**/*.config.*",
        "**/node_modules/**",
      ],
      thresholds: {
        lines: 60,
        branches: 60,
        functions: 60,
        statements: 60,
        perFile: true,
      },
    },
  },
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "./src/$1") },
      // next/navigation 与 next/link 的测试替身（集成测试不挂载 Next App Router）
      { find: /^next\/navigation$/, replacement: path.resolve(__dirname, "./src/test/__mocks__/next-navigation.ts") },
      { find: /^next\/link$/, replacement: path.resolve(__dirname, "./src/test/__mocks__/next-link.tsx") },
      // next-intl 测试替身：以真实 zh.json 为消息源，集成测试不挂载 Next 请求上下文
      { find: /^next-intl$/, replacement: path.resolve(__dirname, "./src/test/__mocks__/next-intl.tsx") },
      // 测试文件位于 frontend/ 之外（tests/dev-integration/frontend/），无法解析 frontend/node_modules，
      // 显式指向本地安装位置（与单元 config 同因）。
      { find: "@testing-library/react", replacement: path.resolve(__dirname, "./node_modules/@testing-library/react") },
      { find: "@testing-library/user-event", replacement: path.resolve(__dirname, "./node_modules/@testing-library/user-event") },
      // TSX 的 JSX runtime 无法从该目录解析 react，显式指向 frontend 的 node_modules。
      { find: /^react\/jsx-dev-runtime$/, replacement: path.resolve(__dirname, "./node_modules/react/jsx-dev-runtime.js") },
      { find: /^react\/jsx-runtime$/, replacement: path.resolve(__dirname, "./node_modules/react/jsx-runtime.js") },
      { find: /^react$/, replacement: path.resolve(__dirname, "./node_modules/react") },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, "./node_modules/react-dom") },
    ],
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, "../tests")],
    },
  },
  optimizeDeps: {
    include: ["@testing-library/react"],
  },
});
