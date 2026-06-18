#!/bin/bash
# 环境初始化脚本
set -euo pipefail

# 始终以仓库根为基准，避免脚本从任意目录调用时路径错乱
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "Initializing development environment..."

# 启用版本控制的 git hook：core.hooksPath 直接指向 scripts/git-hooks/，
# 跨平台无需软链（规避 Windows symlink 权限坑），新 clone 执行本脚本即生效。
echo "Configuring git hooks (core.hooksPath -> scripts/git-hooks)..."
git config core.hooksPath scripts/git-hooks
chmod +x scripts/git-hooks/* 2>/dev/null || true

# 前端（子 shell 隔离 cd，避免影响后续步骤的工作目录）
echo "Installing frontend deps..."
( cd frontend && pnpm install )

# 后端
echo "Installing backend deps..."
( cd backend && uv pip install -e ".[test,dev]" )

echo "Environment initialized successfully!"
