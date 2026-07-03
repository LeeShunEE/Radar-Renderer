#!/usr/bin/env bash
# 生成 merged PR 列表，用于 LLM 总结成 release notes。
# 依赖 GitHub CLI（gh）且已 `gh auth login`，以及 jq（解析 JSON）。
# 用法：
#   bash scripts/gen-release-notes.sh                    # 所有 merged PR（首个版本）
#   bash scripts/gen-release-notes.sh --from-tag v0.1.0  # 某 tag 之后到 HEAD
#   bash scripts/gen-release-notes.sh --since 2026-06-01 # 某日期之后 merged
set -euo pipefail

# 参数解析
FROM_TAG=""
SINCE_DATE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --from-tag)
      FROM_TAG="$2"
      shift 2
      ;;
    --since)
      SINCE_DATE="$2"
      shift 2
      ;;
    *)
      echo "错误：未知参数 $1" >&2
      echo "用法：$0 [--from-tag <tag>] [--since <YYYY-MM-DD>]" >&2
      exit 1
      ;;
  esac
done

# 依赖检查
if ! command -v gh >/dev/null 2>&1; then
  echo "错误：未找到 gh（GitHub CLI）。请先安装并 'gh auth login'。" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "错误：未找到 jq。请安装 jq 以解析 JSON。" >&2
  exit 1
fi

# 构建 gh pr list 参数
GH_ARGS=(--state merged --json number,title,mergedAt,author)

if [[ -n "$SINCE_DATE" ]]; then
  GH_ARGS+=(--search "merged:>=$SINCE_DATE")
fi

# 获取 PR 列表
PR_LIST=$(gh pr list "${GH_ARGS[@]}")

# 如果指定了 --from-tag，进一步过滤
if [[ -n "$FROM_TAG" ]]; then
  # 检查 tag 是否存在
  if ! git rev-parse "$FROM_TAG" >/dev/null 2>&1; then
    echo "错误：tag $FROM_TAG 不存在。" >&2
    exit 1
  fi

  # 提取 tag 之后到 HEAD 的 merge commit 中的 PR 编号
  # merge commit message 格式：Merge pull request #65 from ...
  PR_NUMS=$(git log "$FROM_TAG"..HEAD --merges --oneline | grep -oE '#[0-9]+' | tr -d '#' | sort -u)

  if [[ -z "$PR_NUMS" ]]; then
    echo "警告：$FROM_TAG 之后无 merge commit（无 PR）。" >&2
    exit 0
  fi

  # 过滤 PR_LIST，只保留 PR_NUMS 中的 PR
  PR_LIST=$(echo "$PR_LIST" | jq --arg nums "$PR_NUMS" '
    map(select(.number as $n | ($nums | split(" ") | map(tonumber) | index($n))))
  ')
fi

# 解析并输出
# 格式：#65 feat(comparison): 扩展对比模式 overlay 布局 (@LeeShunEE, 2026-07-03)
echo "$PR_LIST" | jq -r '
  sort_by(.mergedAt) | reverse | .[] |
  "#\(.number) \(.title) (@\(.author.login), \(.mergedAt[:10]))"
'