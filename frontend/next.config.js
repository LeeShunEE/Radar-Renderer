/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 显式锁定 Turbopack workspace 根目录，避免 Next 16 向上推断到错误目录
  // （多 lockfile / 推断歧义场景下会从 src/app 找不到 next 包而构建失败）。
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;