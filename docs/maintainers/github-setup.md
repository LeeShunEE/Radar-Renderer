# Maintainer: GitHub repository setup checklist

> One-time setup that must be done in the GitHub web UI / CLI (cannot live in the
> repo files). Run after pushing the open-source scaffolding to `main`.
> 仅能在 GitHub 网页/CLI 完成的一次性设置（无法写进仓库文件）。在把开源骨架推到
> `main` 后执行。

## 1. Repository basics / 仓库基础

- [ ] Settings → General → set **Description** and **Website**.
- [ ] Add **Topics**: `radar-chart`, `remotion`, `nextjs`, `fastapi`, `data-visualization`, `video`.
- [ ] Settings → General → **Features**: enable **Discussions** and **Issues**;
      enable **Sponsorships** only if desired (we opted out of `FUNDING.yml`).

## 2. Labels / 标签

Run the script (requires `gh` + `gh auth login`):

```bash
bash scripts/setup-labels.sh LeeShunEE/Radar-Renderer
```

Creates: `bug`, `enhancement`, `documentation`, `good first issue`,
`help wanted`, `question`, `duplicate`, `wontfix`, `dependencies`, `frontend`,
`backend`, `ci`.

## 3. Discussions / 讨论区

- [ ] Settings → General → Features → check **Discussions**.
- [ ] In Discussions, keep default categories (Announcements, Q&A, Ideas, Show
      and tell). The issue template `config.yml` already links here.

## 4. Pinned issue / 置顶 issue

- [ ] New issue titled **"Roadmap & Contribution Guide"**; paste the content of
      [`ROADMAP.md`](../../ROADMAP.md).
- [ ] On that issue → **Pin issue**.

```bash
# CLI alternative:
gh issue create --repo LeeShunEE/Radar-Renderer \
  --title "Roadmap & Contribution Guide / 路线图与贡献指引" \
  --body-file ROADMAP.md
# then pin it in the web UI (Pin issue)
```

## 5. Branch protection for `main` / 分支保护

- [ ] Settings → Branches → Add rule for `main`:
  - [ ] Require a pull request before merging.
  - [ ] Require status checks to pass: select **CI / Backend**, **CI / Frontend**,
        and **DCO / Check Signed-off-by**.
  - [ ] Require branches to be up to date before merging.
  - [ ] (Optional) Require review from Code Owners.

## 6. Security / 安全

- [ ] Settings → Security → enable **Private vulnerability reporting**
      (so the `SECURITY.md` advisory link works).
- [ ] Enable **Dependabot alerts** and **Dependabot security updates**
      (the `.github/dependabot.yml` handles version-update PRs).

## 7. First release / 首个发布

When the backend MVP and docs land:

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
gh release create v0.1.0 --generate-notes
```

Update `CHANGELOG.md` (`[Unreleased]` → `[0.1.0] - <date>`) in the same PR.
