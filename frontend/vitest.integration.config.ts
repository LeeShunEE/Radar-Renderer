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
      thresholds: {
        lines: 60,
        branches: 60,
        functions: 60,
        statements: 60,
      },
      exclude: [
        "src/types/**",
        "src/test/**",
        "**/*.config.*",
        "**/node_modules/**",
      ],
    },
  },
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "./src/$1") },
    ],
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, "../tests")],
    },
  },
});
