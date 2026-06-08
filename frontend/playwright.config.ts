import { defineConfig, devices } from "@playwright/test";

/**
 * 前端 testenv Playwright GUI e2e 配置。
 *
 * 连真实后端 + 真实库（见 CLAUDE.md §3.3、§8.4）。
 * baseURL 与库 seed 由测试系统通过环境变量注入，本文件不硬编码连接信息；
 * 仅在本地缺省时回退到 http://localhost:3000，方便开发本地运行。
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  // e2e 代码位于仓库 tests 树下（§2.6 豁免 1:1 对齐，按旅程组织）。
  testDir: "../tests/testenv-integration/frontend",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
