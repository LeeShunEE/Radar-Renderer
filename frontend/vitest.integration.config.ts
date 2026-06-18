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
      include: [
        "src/lib/**",
        "src/hooks/**",
        "src/contexts/**",
        "src/components/**",
      ],
      exclude: [
        "src/types/**",
        "src/test/**",
        "src/components/ui/**", // shadcn 生成的 UI 原语（第三方）
        "src/remotion/**", // Remotion 运行时 composition
        "src/app/**", // Next.js 页面/server components
        "src/lib/browser-render.ts", // 浏览器运行时
        "src/hooks/useLocalRender.ts", // Remotion 运行时
        "src/components/editor/PreviewPanel.tsx", // Remotion Player 运行时
        "src/components/editor/FontFamilyEditor.tsx", // 运行时 require('../../lib/font-list') 走 Node CJS，vitest 无法解析 .ts，单测不可行
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
    ],
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, "../tests")],
    },
  },
});
