const { execSync } = require("child_process");

/**
 * 取构建版本号：git describe --tags --always --dirty 的原生输出。
 * - 有 tag 且 HEAD 在 tag 上: "v1.2.3"
 * - 有 tag 但领先: "v1.2.3-5-gabc1234"
 * - 无 tag（本项目现状）: 纯短 hash，如 "ea79778"（可能带 -dirty）
 * - git 命令彻底失败（无 .git / 无 git 二进制）: 降级 "unknown"
 * execSync 失败时绝不能让 next build 崩，故整段 try/catch。
 * @returns {string}
 */
function getAppVersion() {
  try {
    return execSync("git describe --tags --always --dirty", {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf-8",
    }).trim();
  } catch {
    return "unknown";
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: getAppVersion(),
  },
};

module.exports = nextConfig;
