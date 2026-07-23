const { execSync } = require("child_process");
const createNextIntlPlugin = require("next-intl/plugin");
const pkg = require("./package.json");

// 指向 request.ts：next-intl 据此在每次请求解析 locale 与 messages。
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * 取构建版本号，按优先级降级（整段 try/catch 兜底，绝不让 build 崩）：
 * 1. 注入了 NEXT_PUBLIC_APP_VERSION（非空）→ 直接用（最高优先，便于覆盖/测试）
 * 2. 有 SOURCE_COMMIT（Coolify 容器构建，上下文无 .git）→ "v{pkg.version}-{shortSha}"
 * 3. 本地 pnpm build（有 .git）→ git describe --tags --always --dirty 原生输出
 * 4. 都拿不到 → 兜底 "v{pkg.version}"（比原来的 "unknown" 更有信息量）
 * @returns {string}
 */
function getAppVersion() {
  const injected = process.env.NEXT_PUBLIC_APP_VERSION;
  if (injected && injected.trim()) return injected.trim();
  const sha = process.env.SOURCE_COMMIT;
  if (sha && sha.trim()) return `v${pkg.version}-${sha.trim().slice(0, 7)}`;
  try {
    return execSync("git describe --tags --always --dirty", {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf-8",
    }).trim();
  } catch {
    return `v${pkg.version}`;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: getAppVersion(),
  },
};

module.exports = withNextIntl(nextConfig);
