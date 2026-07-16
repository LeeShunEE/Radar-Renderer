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
        "src/remotion/**", // Remotion 运行时 composition，依赖 Chromium，单测不可行
        "src/app/**", // Next.js 路由页面/server components，e2e 验证
        "src/lib/browser-render.ts", // 浏览器运行时
        "src/lib/mp4-encoder.ts", // WebCodecs 运行时，依赖浏览器 API
        "src/lib/render-media-source.ts", // AudioContext 运行时，依赖浏览器 API
        "src/hooks/useLocalRender.ts", // Remotion 运行时
        "src/components/editor/PreviewPanel.tsx", // Remotion Player 运行时，依赖 Chromium；渲染由 testenv Playwright e2e 验证
        "src/components/editor/LocalRenderStage.tsx", // Remotion Player + WebCodecs 运行时，e2e 验证
        "src/components/editor/FontFamilyEditor.tsx", // 运行时 require('../../lib/font-list') 走 Node CJS，vitest 无法解析 .ts，单测不可行
        "**/*.config.*",
        "**/node_modules/**",
      ],
      thresholds: {
        // vitest perFile 复用同一组阈值，无法设「全局 60 / 每文件 50」分离值。
        // 采用全局 60% + 每文件 60%：既满足 CLAUDE.md §7.1 总门槛，又超满足每文件 50% 兜底。
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
      // next/navigation 与 next/link 的测试替身（单元测试不挂载 Next App Router）
      { find: /^next\/navigation$/, replacement: path.resolve(__dirname, "./src/test/__mocks__/next-navigation.ts") },
      { find: /^next\/link$/, replacement: path.resolve(__dirname, "./src/test/__mocks__/next-link.tsx") },
      { find: "@testing-library/react", replacement: path.resolve(__dirname, "./node_modules/@testing-library/react") },
      // 测试文件位于 frontend/ 之外（tests/unit/frontend/），无法解析 frontend/node_modules，
      // 显式指向本地安装位置（与 @testing-library/react 同因）。
      { find: "@testing-library/user-event", replacement: path.resolve(__dirname, "./node_modules/@testing-library/user-event") },
      // 测试文件位于 frontend/ 之外（tests/unit/frontend/），TSX 的 JSX runtime
      // 无法从该目录解析 react，显式指向 frontend 的 node_modules。
      { find: /^react\/jsx-dev-runtime$/, replacement: path.resolve(__dirname, "./node_modules/react/jsx-dev-runtime.js") },
      { find: /^react\/jsx-runtime$/, replacement: path.resolve(__dirname, "./node_modules/react/jsx-runtime.js") },
      { find: /^react$/, replacement: path.resolve(__dirname, "./node_modules/react") },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, "./node_modules/react-dom") },
      // remotion：测试文件在 frontend/ 外时需显式指向 node_modules（同 react）
      { find: /^remotion$/, replacement: path.resolve(__dirname, "./node_modules/remotion") },
      // @remotion/media：同上，且保证 vi.mock("@remotion/media") 命中被测源码解析的同一模块路径
      { find: /^@remotion\/media$/, replacement: path.resolve(__dirname, "./node_modules/@remotion/media") },
      // @remotion/effects/color-key：同因（测试在 frontend/ 外），指向 esm 产物保证 vi.mock 命中
      { find: /^@remotion\/effects\/color-key$/, replacement: path.resolve(__dirname, "./node_modules/@remotion/effects/dist/esm/color-key.mjs") },
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