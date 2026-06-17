import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["../tests/unit/frontend/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 60,
        branches: 60,
        functions: 60,
        statements: 60,
      },
      include: ["src/lib/**", "src/hooks/**"],
      exclude: [
        "src/types/**",
        "src/test/**",
        "**/*.config.*",
        "**/node_modules/**",
        "src/lib/browser-render.ts",
        "src/hooks/useLocalRender.ts",
      ],
    },
  },
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "./src/$1") },
      // next/navigation 与 next/link 的测试替身（单元测试不挂载 Next App Router）
      { find: /^next\/navigation$/, replacement: path.resolve(__dirname, "./src/test/__mocks__/next-navigation.ts") },
      { find: /^next\/link$/, replacement: path.resolve(__dirname, "./src/test/__mocks__/next-link.tsx") },
      { find: "@testing-library/react", replacement: path.resolve(__dirname, "./node_modules/@testing-library/react") },
      // 测试文件位于 frontend/ 之外（tests/unit/frontend/），TSX 的 JSX runtime
      // 无法从该目录解析 react，显式指向 frontend 的 node_modules。
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