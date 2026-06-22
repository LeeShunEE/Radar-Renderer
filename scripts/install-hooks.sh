#!/bin/bash
# 安装 git hook（core.hooksPath -> scripts/git-hooks）
# 幂等：可重复运行；只装 hook，不装前后端依赖。
# 详见 CONTRIBUTING.md §1 与 CLAUDE.md §7.4
set -euo pipefail

# 始终以仓库根为基准，避免脚本从任意目录调用时路径错乱
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "Configuring git hooks (core.hooksPath -> scripts/git-hooks)..."

# core.hooksPath 直接指向 scripts/git-hooks/，跨平台无需软链（规避 Windows
# symlink 权限坑）。git clone 不会自动运行任何安装脚本，故每个新 clone / 新
# 环境都必须手动跑一次本脚本，否则 commit / push 不会触发本地检查（见
# CONTRIBUTING.md §1）。
git config core.hooksPath scripts/git-hooks
chmod +x scripts/git-hooks/* 2>/dev/null || true

echo "Git hooks installed — pre-commit / pre-push 现已生效。"
