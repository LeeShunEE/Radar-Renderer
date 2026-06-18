#!/usr/bin/env bash
# 一键创建/更新仓库 issue 标签体系。
# 依赖 GitHub CLI（gh）且已 `gh auth login`。
# 用法：bash scripts/setup-labels.sh [owner/repo]
#   省略参数时使用当前目录 git 仓库的默认远端。
set -euo pipefail

REPO="${1:-}"
REPO_ARG=()
if [ -n "$REPO" ]; then
  REPO_ARG=(--repo "$REPO")
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "错误：未找到 gh（GitHub CLI）。请先安装并 'gh auth login'。" >&2
  exit 1
fi

# 格式：名称|颜色(hex,无#)|描述
labels=(
  "bug|d73a4a|缺陷 / Something isn't working"
  "enhancement|a2eeef|新功能或改进 / New feature or request"
  "documentation|0075ca|文档相关 / Docs improvements"
  "good first issue|7057ff|适合新手上手 / Good for newcomers"
  "help wanted|008672|欢迎社区认领 / Extra attention is wanted"
  "question|d876e3|提问（一般请转 Discussions）/ Further information requested"
  "duplicate|cfd3d7|重复 / Duplicate issue or PR"
  "wontfix|ffffff|不予修复 / This will not be worked on"
  "dependencies|0366d6|依赖更新 / Dependency bumps"
  "frontend|fbca04|前端 / Next.js + Remotion"
  "backend|5319e7|后端 / FastAPI"
  "ci|ededed|CI / 构建与工具链"
)

for entry in "${labels[@]}"; do
  IFS='|' read -r name color desc <<<"$entry"
  echo ">> $name"
  # 已存在则更新，不存在则创建
  gh label create "$name" --color "$color" --description "$desc" "${REPO_ARG[@]}" 2>/dev/null \
    || gh label edit  "$name" --color "$color" --description "$desc" "${REPO_ARG[@]}"
done

echo "标签体系已同步完成。"
