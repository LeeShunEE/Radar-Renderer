# Radar-Renderer

**[⚡立刻创建雷达图动画](https://radar.xn--30q18ry71c.com/)**

[![CI](https://github.com/LeeShunEE/Radar-Renderer/actions/workflows/ci.yml/badge.svg)](https://github.com/LeeShunEE/Radar-Renderer/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](./LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

> [English](./README.md) · **简体中文**

将**雷达图渲染为动画视频**的工具，面向多模型/多对象的并排对比可视化。
前端为 Next.js + Remotion 应用；后端为 FastAPI 服务（开发中）。

<p align="center">
  <img src="assets/panel-demo.gif" alt="全员面板渲染预览" width="720">
</p>

<p align="center">
  <a href="https://www.bilibili.com/video/BV1zuLK6sE4a">查看完整视频</a>
</p>

## 特性

- 🎬 **视频化雷达图** —— 通过 Remotion 把雷达图可视化渲染成视频。
- 🆚 **多模型对比** —— 在同一面板上叠加并对比多个对象。
- 🧩 **可组合前端** —— Next.js 16 + React 19 + Remotion player & renderer。
- ⚙️ **API 后端** —— FastAPI 提供鉴权、存储与服务端渲染（开发中）。
- ✅ **测试先行** —— 三阶测试体系（unit / dev-integration / testenv-integration）+ 覆盖率门槛。

## 技术栈

| 层 | 技术 |
| - | - |
| 前端 | Next.js 16、React 19、Remotion 4、Tailwind CSS 4、Zod |
| 后端 | FastAPI、Uvicorn、Python 3.11+（用 `uv` 管理） |
| 工具链 | pnpm（前端）、uv（后端）、Vitest、Pytest、Playwright、Ruff、ESLint |

## 快速开始

### 前置要求

- Node.js 20+ 与 [pnpm](https://pnpm.io/) 9
- Python 3.11+ 与 [uv](https://docs.astral.sh/uv/)

### 前端

```bash
cd frontend
pnpm install
pnpm dev
```

### 后端

```bash
cd backend
uv pip install -e ".[test,dev]"
uv run uvicorn app.main:app --reload
```

### Git hook（每个 clone 装一次）

安装本地 hook，让 `git commit` / `git push` 跑与 CI 相同的 lint + 测试。**Git hook
不进版本控制**，因此每个新 clone（你的机器、CI、新同事）都必须手动跑一次：

```bash
bash scripts/install-hooks.sh   # 轻量：只装 hook，不装依赖
# 或一次性全量引导（hook + 前后端依赖）：bash scripts/init_env.sh
```

### 环境变量

复制模板并填入真实值（真实 `.env` 已被 git 忽略，**切勿提交任何密钥**）：

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env
cp deploy/.env.example   deploy/.env   # 仅容器化部署需要
```

## 目录结构

- `frontend/` —— Next.js + Remotion 前端
- `backend/` —— FastAPI 后端（开发中）
- `tests/` —— 统一三阶测试树（`unit/`、`dev-integration/`、`testenv-integration/`）
- `scripts/` —— 工具脚本与 git hook 镜像
- `deploy/` —— 容器/compose 部署
- `docs/` —— 设计笔记、审计与计划

## 测试

```bash
# 后端（单元 + dev-integration）
cd backend && uv run pytest ../tests/unit/backend/ ../tests/dev-integration/backend/ -v

# 前端
cd frontend && pnpm test:unit && pnpm test:integration
```

完整规范（测试分层、命名规则、覆盖率门槛、commit 格式）见
[`CLAUDE.md`](./CLAUDE.md)，并在 [`CONTRIBUTING.md`](./CONTRIBUTING.md) 中提炼为人类可读版。

## 资源文件

`frontend/public/silhouettes/` 与 `frontend/public/music/` 下的资源文件**不**进仓库，
请在本地手动添加所需资源到对应目录。

## 参与贡献

欢迎贡献！请先阅读 [`CONTRIBUTING.md`](./CONTRIBUTING.md)——注意所有 commit
必须带 **DCO 签名**（`git commit -s`）。参与本项目即表示同意遵守
[`行为准则`](./CODE_OF_CONDUCT.md)。

## 许可证

本项目采用 **GNU General Public License v3.0**，见 [`LICENSE`](./LICENSE)。

> ⚠️ **第三方提示 —— Remotion。** 前端依赖
> [Remotion](https://www.remotion.dev/)，它采用**自有许可**（source-available；
> 个人与小公司免费，达到规模的公司需付费的公司授权）。Remotion **不是** OSI 开源，
> 与本项目的 GPL-3.0 授权**相互独立**。使用或构建本项目时，你需**单独遵守**
> Remotion 的许可条款。详见 [`NOTICE`](./NOTICE) 与 https://www.remotion.dev/license。
