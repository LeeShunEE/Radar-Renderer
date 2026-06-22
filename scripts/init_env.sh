#!/bin/bash
# 环境初始化脚本
set -euo pipefail

# 始终以仓库根为基准，避免脚本从任意目录调用时路径错乱
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "Initializing development environment..."

# 1) git hook：装 hook 的轻量步骤已抽到独立脚本，可单独运行（不必连带装依赖）
bash scripts/install-hooks.sh

# 前端（子 shell 隔离 cd，避免影响后续步骤的工作目录）
echo "Installing frontend deps..."
( cd frontend && pnpm install )

# 后端
echo "Installing backend deps..."
( cd backend && uv pip install -e ".[test,dev]" )

echo "Environment initialized successfully!"
