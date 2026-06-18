# 仓库开源化开发计划

> 创建日期：2026-06-18
> 项目：Radar Chart Rendering — 视频雷达图渲染工具（Next.js + Remotion 前端 / FastAPI 后端）

## 决策基线

| 项 | 决定 |
| - | - |
| 开源许可证 | **GPL-3.0** |
| License header | **仅在 LICENSE/README 声明**，源文件不逐个加头部 |
| 贡献者协议 | **DCO**（commit `Signed-off-by`，CI 校验） |
| CI 范围 | **单元 + dev-integration + 覆盖率门槛**，不含 testenv e2e |
| CLAUDE.md | **保留并提炼**进 CONTRIBUTING.md |
| 文档语言 | **中英双语** |
| 社区设施 | **全套**（Discussions + 置顶 issue + 标签 + Releases） |
| FUNDING | **不需要** |
| 历史泄密扫描 | **纳入计划**（阶段 0 前置闸门） |

## 摸底结论

- ✅ 本地产物已干净：`.claude/`、`.coverage`、`.pytest_cache/`、`.playwright-mcp/` 已在 `.gitignore` 且未被 git 跟踪。
- ⚠️ 55 个 commit 全部来自单一邮箱 `2457013396@qq.com`（与 git config 的 `LeeShunEE` 不一致）——阶段 0 需核对身份/是否脱敏。

---

## 阶段 0 — 安全前置闸门（必须先过）

1. git 历史泄密扫描：`gitleaks detect` + `trufflehog` 扫全历史，重点查 OAuth 凭证、token、`.env`、密钥。
2. 作者邮箱核对：确认 `2457013396@qq.com` 身份；若需统一/脱敏，评估是否 rewrite history（开源前唯一时机）。
3. `.claude/settings.local.json` 复核：确认无凭据后维持 ignore。
4. 🚦 闸门：扫描有泄露 → 先 `git filter-repo` 清理并轮换凭证，再进入阶段 1。

## 阶段 1 — 法律与治理（GPL-3.0）

5. `LICENSE` — GPL-3.0 全文。
6. License 声明策略：仅在 `LICENSE` + README 顶部声明 GPL-3.0，**源文件不逐个加 header**（决策：从简）。
7. `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1（中英双语）。
8. 第三方依赖许可合规核查：扫 `backend/pyproject.toml` + `frontend/package.json` 依赖许可，确认与 GPL-3.0 兼容（重点查 Apache-2.0 专利条款冲突、私有许可）。
   - **核查结论**：后端（fastapi/uvicorn/pytest/httpx）全宽松许可，兼容。前端绝大多数 MIT/BSD/ISC。
   - ⚠️ **Remotion（`@remotion/*` + `remotion`）为自有「Remotion License」**——source-available 但非 OSI 开源，个人/小公司免费、规模公司需付费授权，与 GPL-3.0 存在理论兼容性争议。**处理：** 在 README/NOTICE 显著标注 Remotion 独立授权要求，提醒下游单独遵守。

## 阶段 2 — `.github/` 机制

9. `ISSUE_TEMPLATE/bug_report.yml` + `feature_request.yml` + `config.yml`（双语字段，外链 Discussions）。
10. `PULL_REQUEST_TEMPLATE.md` — 含 DCO 勾选、测试通过、文档更新清单。
11. `workflows/ci.yml` — PR 触发：
    - 后端：`ruff` + `pytest unit + dev-integration` + 覆盖率 ≥80% / 每文件 ≥50%。
    - 前端：`eslint` + `pnpm test:unit + test:integration` + 覆盖率 ≥60% / 每文件 ≥50%。
    - **不含 testenv e2e**（需真实后端/库）。
12. `workflows/dco.yml`（或启用 DCO App）— 校验 `Signed-off-by`。
13. `dependabot.yml` — pip + npm 两个 ecosystem。
14. `CODEOWNERS`。

## 阶段 3 — 贡献者上手文档（中英双语）

15. README 强化：`README.md`（英）+ `README.zh-CN.md`（中），含徽章（CI/coverage/license/GPL）、截图（已有 `assets/panel-demo.gif`）、特性、技术栈、快速开始、架构概览。
16. `CONTRIBUTING.md` — 从 CLAUDE.md 提炼：三阶测试体系、命名规则、commit 规范（§10）、依赖声明流程（§5.3）、git hook（§7.4）、DCO 签名说明。双语。
17. `SECURITY.md` — 漏洞私下披露渠道 + 支持版本。
18. `CHANGELOG.md` — Keep a Changelog 骨架。
19. `.env.example` — 后端/前端各一份（呼应 CLAUDE.md §3.3.1 禁硬编码凭据）。
20. CLAUDE.md 保留，并在 README/CONTRIBUTING 注明「AI 代理规范，贡献者亦可参考」。

## 阶段 4 — 社区运营设施（全套）

21. GitHub Discussions 启用（仓库 settings 操作，提供步骤清单）。
22. 置顶 issue：Roadmap + 贡献指引索引 + good-first-issue 聚合（内容进 issue，并与 CONTRIBUTING 互链）。
23. 标签体系：`good first issue` / `help wanted` / `bug` / `enhancement` / `documentation`（提供 `gh label` 脚本）。
24. ~~FUNDING.yml~~ — 不需要。
25. Release 流程：语义化版本 + tag + GitHub Releases 说明（写进 CONTRIBUTING）。

---

## 交付方式

- 按阶段推进，阶段 0 必须先跑并汇报结果才继续。
- 文件改动按主题分 commit（遵循 CLAUDE.md §10 规范 + 加 `Signed-off-by` 示范 DCO）。
- 需 GitHub 网页端操作的（Discussions、置顶、仓库 settings）提供清晰步骤清单。
