import path from "node:path";
import { Module } from "node:module";
import { defineConfig, devices } from "@playwright/test";

/**
 * 前端 testenv Playwright GUI e2e 配置。
 *
 * 连真实后端 + 真实库（见 CLAUDE.md §3.3、§8.4）。
 * baseURL 与库 seed 由测试系统通过环境变量注入，本文件不硬编码连接信息；
 * 仅在本地缺省时回退到 http://localhost:13000，方便开发本地运行。
 */

// e2e spec 位于仓库根 tests/ 树下（§2.6），而依赖装在 frontend/node_modules。
// Node 从 spec 所在目录向上解析找不到 frontend 的依赖（无 workspace 提升），
// 故把 frontend/node_modules 注入模块搜索路径，让 spec 的 `@playwright/test`
// 等 import 可解析。这样文档约定的 `cd frontend && pnpm exec playwright test`
// 无需额外环境变量即可开箱运行。
process.env.NODE_PATH = [
  path.join(__dirname, "node_modules"),
  process.env.NODE_PATH,
]
  .filter(Boolean)
  .join(path.delimiter);
(Module as unknown as { _initPaths: () => void })._initPaths();
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000";

// i18n 增量迁移期间，应用默认 locale 为 en（见 src/i18n/config.ts），但多数 e2e
// spec 仍按中文文案取选择器（编辑器/文件等域尚未迁移）。这里预置 NEXT_LOCALE=zh
// Cookie，把整个应用（含已迁移的 auth 域）钉在中文，使既有中文选择器稳定可用。
// 待各域迁移完成后可改为 data-testid 选择器，并新增 en 语言切换旅程 spec。
const localeStorageState = {
  cookies: [
    {
      name: "NEXT_LOCALE",
      value: "zh",
      domain: new URL(baseURL).hostname,
      path: "/",
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    },
  ],
  origins: [],
};

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
    storageState: localeStorageState,
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