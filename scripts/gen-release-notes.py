#!/usr/bin/env python
# 生成 merged PR 列表，用于 LLM 总结成 release notes。
# 依赖 GitHub CLI（gh）且已 `gh auth login`。
# 用法：
#   python scripts/gen-release-notes.py                    # 所有 merged PR（首个版本）
#   python scripts/gen-release-notes.py --from-tag v0.1.0  # 某 tag 之后到 HEAD
#   python scripts/gen-release-notes.py --since 2026-06-01 # 某日期之后 merged
"""Generate merged PR list for LLM summarization into release notes."""

import argparse
import json
import subprocess
import sys
from pathlib import Path


def get_merged_prs(since_date: str | None = None) -> list[dict]:
    """Fetch merged PRs via gh CLI."""
    args = ["gh", "pr", "list", "--state", "merged", "--json", "number,title,mergedAt,author,url"]
    if since_date:
        args.extend(["--search", f"merged:>={since_date}"])
    result = subprocess.run(args, capture_output=True, encoding="utf-8", check=True)
    return json.loads(result.stdout)


def get_pr_numbers_after_tag(tag: str) -> set[int]:
    """Extract PR numbers from merge commits after given tag."""
    # Check tag exists
    result = subprocess.run(
        ["git", "rev-parse", tag],
        capture_output=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        print(f"错误：tag {tag} 不存在。", file=sys.stderr)
        sys.exit(1)

    # Get merge commits after tag
    result = subprocess.run(
        ["git", "log", f"{tag}..HEAD", "--merges", "--oneline"],
        capture_output=True,
        encoding="utf-8",
        check=True,
    )

    # Extract PR numbers from "Merge pull request #65 from ..."
    pr_nums = set()
    for line in result.stdout.splitlines():
        if "#" in line:
            # Extract number after #
            import re
            match = re.search(r"#(\d+)", line)
            if match:
                pr_nums.add(int(match.group(1)))

    return pr_nums


def format_pr_list(prs: list[dict]) -> str:
    """Format PR list as markdown lines with links."""
    # Sort by mergedAt descending (most recent first)
    sorted_prs = sorted(prs, key=lambda p: p["mergedAt"], reverse=True)

    lines = []
    for pr in sorted_prs:
        # Format: [#65](url) feat(comparison): 扩展对比模式 overlay 布局 (@LeeShunEE, 2026-07-03)
        date = pr["mergedAt"][:10]  # YYYY-MM-DD
        author = pr["author"]["login"]
        url = pr["url"]
        lines.append(f"[#{pr['number']}]({url}) {pr['title']} (@{author}, {date})")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from-tag", help="Get PRs merged after this tag")
    parser.add_argument("--since", help="Get PRs merged on or after this date (YYYY-MM-DD)")
    args = parser.parse_args()

    # Check gh available
    result = subprocess.run(["gh", "--version"], capture_output=True)
    if result.returncode != 0:
        print("错误：未找到 gh（GitHub CLI）。请先安装并 'gh auth login'。", file=sys.stderr)
        sys.exit(1)

    # Get PR list
    prs = get_merged_prs(args.since)

    # Filter by tag if specified
    if args.from_tag:
        pr_nums = get_pr_numbers_after_tag(args.from_tag)
        if not pr_nums:
            print(f"警告：{args.from_tag} 之后无 merge commit（无 PR）。", file=sys.stderr)
            return
        prs = [p for p in prs if p["number"] in pr_nums]

    # Output formatted list
    print(format_pr_list(prs))


if __name__ == "__main__":
    main()