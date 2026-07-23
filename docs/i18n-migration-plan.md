# 前端 i18n 后续域迁移计划（方案 A）

> 状态：**全部完成**。任务 0–6 均已 commit 并通过门禁（build/tsc/unit/integration/lint 全绿）。
> 本文件是后续域迁移的**权威任务清单**，每域一个任务，含文件清单、命名空间、验收标准。
> auth 域已在 commit `d860123` 完成（见 §2）。
>
> **完成记录**：
> - 任务 0（common/外壳）、1（tasks）、2（files）、3（settings）：见早期 commit。
> - 任务 4（editor，巨型）：4a 外壳 `411c540`；4b 数值/属性/字体 `67af310`；4c 角色/主题 `2c64cdd`；
>   4d 对比/叠加/全局/布局 `2fc6fa1`；4e 动画/背景 `7fdbc99`；4f 特效 `90334b9`；4g 导出/存档/渲染/预览 `39a4269`。
> - 任务 5（lib/hook 错误串收尾）：`cd18b46`（errors 命名空间 + format locale 参数 + media-guard 结构化
>   + lib 非 hook 模块英文兜底 + OAuth 回调/color-picker/dialog 补漏）。
> - 任务 6（e2e 演进）：`0e099f3`（新增 en/zh 语言切换旅程 spec；zh 预置保留为默认中文兜底）。
>
> **源码非注释中文剩余项（刻意保留）**：`src/i18n/config.ts` 的 `zh: "中文"`（语言自称）、
> `src/lib/format.ts` 的 zh 分支（locale 条件文案）、`console.*` 日志、`src/remotion/` 注释、
> `src/test/` mock（模拟后端中文响应/示例数据）。

---

## 1. 总览与决策

- **技术**：`next-intl` no-i18n-routing 模式，locale 存 `NEXT_LOCALE` Cookie，不进 URL。
- **默认语言**：`en`（英文），可选 `zh`（中文）。`messages/{en,zh}.json`，en 为基准 key 集。
- **后端错误**：按既定决策 **1c**，后端返回的 `err.message` **原样透传**，不做前端翻译；
  仅前端自有兜底/校验文案走 `t()`。
- **增量迁移**：每域一个 commit。未迁移域仍硬编码中文；e2e 用 `NEXT_LOCALE=zh` Cookie
  钉中文，使既有中文选择器在迁移期间持续可用（已迁域的 zh.json 文案与原文一致）。
- **Remotion 渲染层**（`src/remotion/`）**不迁移**——上屏文字全是用户数据，中文仅为注释。

## 2. 已完成：auth 域（commit d860123）

`src/i18n/`（config/request/locale）、`messages/{en,zh}.json`、root layout 异步化、
`LanguageSwitcher`，以及 `auth.*` 命名空间（login/register/forgot-password/welcome/OAuth/
UserMenu/AuthGuard）+ `common.loading`、`metadata.*`、`language.label`。

## 3. 迁移操作手册（每域通用 checklist）

1. 读该域全部组件，抽取所有硬编码中文（**只动 UI 文案，不动中文注释/docstring**）。
2. 在 `messages/en.json` 与 `messages/zh.json` 新增 `<域>` 命名空间；en 译文 + zh 原文，
   **key 集与占位符必须一致**（`messages.test.ts` 守卫会卡）。
3. 组件改 `useTranslations('<域>')`（Client）或 `getTranslations`（Server）。
4. **跨域复用**：保存/删除/取消/加载中等通用词归入既有 `common` 命名空间，勿各域重写。
5. 验证：`pnpm lint` + `pnpm exec tsc --noEmit`（去 TS5107/5101 噪音）+ **`pnpm build`**（金标准）
   + `pnpm test:unit`（覆盖率达标）+ `pnpm test:integration`。
6. commit：`feat(frontend): i18n 迁移 <域> 文案`，带 `-s` DCO + `Co-Authored-By`。

## 4. 迁移顺序（方案 A：先小后大，边迁边攒 common 词表）

### 任务 0 · common 词表 + 应用外壳（奠基）

- 新增/扩充 `common` 命名空间：save / delete / cancel / confirm / reset / loading /
  add / remove / edit / close / yes / no / done / error 等（按实际抽取补齐，边用边加）。
- 迁移文件：
  - `src/components/layout/Footer.tsx`
  - `src/app/app/layout.tsx`（应用顶栏 chrome）
  - `src/app/app/page.tsx`（编辑器壳入口文案）
  - `src/app/page.tsx`（根落地页文案）
- 命名空间：`common`、`footer`、`app`。
- **验收**：build + tsc + unit + integration + lint 全绿；en/zh 切换可见。

### 任务 1 · tasks 域（小，自洽）

- 文件：`src/components/tasks/{TaskQueuePanel,TaskStatusBadge,TaskEtaDisplay}.tsx`
- 命名空间：`tasks`。状态枚举（pending/processing/done/failed/cancelled 等）走
  `tasks.status.<value>` 模式，确立 **Enum→翻译** 范式。
- **验收**：同 §3 step 5；server-render / task-flow e2e 在 zh Cookie 下持续通过。

### 任务 2 · files 域（小，自洽）

- 文件：`src/components/files/{AssetSelector,FileManagerPanel}.tsx`
- 命名空间：`files`（上传/配额/列表/删除/空态/错误）。配额/大小等插值用 ICU `{used}/{total}`。
- **验收**：同上；file-and-asset e2e 在 zh Cookie 下持续通过。

### 任务 3 · settings 页文案

- 文件：`src/app/app/settings/page.tsx`（切换器已加，文案仍中文）
- 命名空间：`settings`（账户信息/OAuth 绑定/改密/改用户名/解绑）。可复用 `auth.welcome`
  既有校验文案。
- **验收**：同上。

### 任务 4 · editor 域（巨型，按面板分多个 commit）

20 文件 / 379 行。**逐面板一个 commit**，每 commit 都跑金标准 build。建议拆分顺序：

| 子任务 | 文件 |
| - | - |
| 4a 外壳 + Tab | `RadarEditor.tsx`、`PageConfigPanel.tsx`（Tab 容器）、`ImportFromMenu.tsx` |
| 4b 数值/页配置 | `RadarValuesTable.tsx`、`AttributeEditor.tsx`、`FontSizeEditor.tsx`、`FontFamilyEditor.tsx` |
| 4c 角色配置 | `CharacterConfig.tsx`、`ThemeEditor.tsx` |
| 4d 对比/叠加 | `ComparisonConfigPanel.tsx`、`GlobalOverridePanel.tsx`、`GlobalConfigEditor.tsx`、`LayoutEditor.tsx` |
| 4e 背景/媒体 | `BackgroundConfigPanel.tsx`、`AnimationConfig.tsx` |
| 4f 特效 | `EffectsConfigEditor.tsx` |
| 4g 导出/渲染 | `ExportPanel.tsx`、`ConfigPersistencePanel.tsx`、`LocalRenderStage.tsx`、`PreviewPanel.tsx` |

- 命名空间：`editor.*`（按面板分子命名空间，如 `editor.tabs` / `editor.values` /
  `editor.comparison` / `editor.export`）。复用 `common`、`files`、`tasks` 既有 key。
- **验收**：每个子任务 build + tsc + unit + integration + lint 全绿；editor-and-preview /
  comparison-overlay / background-media / local-render 等 e2e 在 zh Cookie 下持续通过。

### 任务 5 · lib / hook 错误串归类（收尾）

- 文件：`src/lib/**`（102 行）、`src/hooks/**`（18 行）中的 **前端自有 throw/错误串**。
- 原则（决策 1c）：后端 `err.message` 继续透传，不翻译；只把**前端产生**的错误改为稳定
  key（在抛出处用错误码，消费端 `t()` 映射），或归入 `common.error` / `errors` 命名空间。
- 多数已在各域消费时顺带处理；本任务是查漏补缺 + 删除残留裸中文 throw。
- **验收**：源码内 `grep` 剩余非注释中文仅限刻意保留项（如后端透传、log 记录的中文）。

### 任务 6 · e2e 演进（全域迁完后）

- 将 e2e 从「zh Cookie 钉中文 + 文案选择器」演进为 **data-testid 选择器**（去耦合文案）。
- 新增一条 **en/zh 语言切换旅程 spec**（点 LanguageSwitcher → 断言文案变化、Cookie 写入）。
- 评估是否移除 `playwright.config.ts` 的 `NEXT_LOCALE=zh` 预置（或保留为默认中文兜底）。
- **验收**：`pnpm exec playwright test tests/testenv-integration/frontend/` 全绿
  （需测试系统注入真实后端 + seed；本地许可时跑一次）。

## 5. 完成判据

- 任务 0–5 全部 commit 且各阶段门禁（build/tsc/unit/integration/lint）全绿。
- 源码内非注释中文仅剩刻意保留项（后端透传、logger 记录）。
- en/zh 两套 messages key 集与占位符一致（守卫持续通过）。
- 任务 6 e2e 通过（如本地许可）。
- 全程不碰 Remotion 层、不动 `messages` 之外的 i18n 基础设施契约。

## 6. 风险与备忘

- editor 域类型风险最高：每子任务**必跑 `pnpm build`**（tsc 会漏报 union 扩散，见
  `frontend-typecheck-vitest-esbuild-blindspot`）。
- `messages.test.ts` 守卫会卡 key/占位符不一致——en/zh 同步编辑。
- 本地 `:13000` dev 栈改 `src` 后需 `docker restart deploy-frontend-1`（见
  `docker-dev-frontend-src-needs-restart`）；新增依赖才需 `--build`（已完成）。
