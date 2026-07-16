# Roadmap & Contribution Guide / 路线图与贡献指引

> This page is also meant to be pinned as an issue. / 本页同时用作置顶 issue 内容。
>
> [English](#english) · [简体中文](#简体中文)

## English

### Where to start

- 📖 New here? Read the [README](https://github.com/LeeShunEE/Radar-Renderer/blob/main/README.md) and [CONTRIBUTING](https://github.com/LeeShunEE/Radar-Renderer/blob/main/CONTRIBUTING.md).
- 🟢 Looking for a first task? Filter issues by
  [`good first issue`](https://github.com/LeeShunEE/Radar-Renderer/labels/good%20first%20issue)
  and [`help wanted`](https://github.com/LeeShunEE/Radar-Renderer/labels/help%20wanted).
- 💬 Questions / ideas? Use
  [Discussions](https://github.com/LeeShunEE/Radar-Renderer/discussions),
  not issues.
- 🔒 Security? See [SECURITY.md](https://github.com/LeeShunEE/Radar-Renderer/blob/main/SECURITY.md) — report privately.
- 🤝 Conduct? See [CODE_OF_CONDUCT.md](https://github.com/LeeShunEE/Radar-Renderer/blob/main/CODE_OF_CONDUCT.md) — be kind and respectful.

### Status

The project is **pre-1.0**. The frontend (Next.js + Remotion) is the most mature
part; the backend (FastAPI) is under active development.

### Roadmap (high level)

> Living document — order and scope may change. Discuss items in Discussions
> before large PRs.

#### Phase 1: Core Foundation (Current)

- [ ] **Backend MVP** — auth, storage, server-side render pipeline hardening.
- [ ] **Rendering UX** — preset panels, export options, performance tuning.
- [ ] **Docs** — architecture overview, API reference, deployment guide.
- [ ] **Test depth** — broaden dev-integration coverage; stabilize Playwright e2e.
- [ ] **First tagged release** — `v0.1.0` once backend MVP + docs land.

#### Phase 2: Visual Enhancement Features

Three major visual features planned for the next phase. See linked issues for details.

##### 2.1 Side-by-Side Comparison Mode

> Issue: #17

Extend the existing comparison system (`ComparisonPairConfig`) to support
left-right parallel display instead of the current before-after transition.

**Key changes:**
- Add `layout: 'transition' | 'side-by-side'` to comparison config
- Create `SideBySideLayer` component for parallel display
- Label positioning & collision avoidance for dual charts
- Animation sync when playing both charts simultaneously

**Acceptance criteria:**
- Users can choose between transition (A → B) and side-by-side (A | B)
- Side-by-side mode maintains all existing styling options
- Labels avoid overlap with minimum spacing validation

##### 2.2 Background Media Support

> Issue: #18

Support images and videos as background, replacing the current CSS-only gradient
system (`BackgroundGradient`).

**Key changes:**
- Extend background config with `type: 'gradient' | 'image' | 'video'`
- Add `BackgroundMedia` component wrapping Remotion `<Image>` / `<Video>`
- Background video play controls (loop, muted, playbackRate)
- Vignette overlay compatibility with media backgrounds

**Acceptance criteria:**
- Users can upload/select background media files
- Media backgrounds render correctly with radar overlay
- Performance acceptable for video backgrounds under 1080p

##### 2.3 Standalone Video Pages with Chroma Key Effect

> Issue: #19 — ✅ Implemented

Mix standalone video pages with radar pages in the multi-page timeline, with
green/blue screen keying via the `@remotion/effects` package.

**Key changes:**
- `pages` becomes a union of radar pages and video pages (`VideoPageSchema`);
  legacy configs without `pageType` fall back to radar with zero migration
- New `VideoPage` composition: source video with fit / audio controls,
  chroma key (`@remotion/effects`), and backing background media
- Green/blue screen presets plus custom key color with
  similarity / smoothness / spill-suppression sliders
- Adjacent video pages can overlap (frame offset + top-layer choice),
  e.g. keyed foreground person over the previous clip
- Editor support: add/configure video pages, overlap pairing panel,
  single-page preview, multi-page export

**Acceptance criteria:**
- Users can add video pages alongside radar pages and reorder freely
- Green/blue screen videos are correctly keyed with configurable thresholds
- Overlapping adjacent video clips render with correct timing and layering

#### Phase 3: Platform & Integration

- [ ] **Plugin system** — custom layer types, effect extensions.
- [ ] **Cloud rendering** — distributed render queue, progress tracking.
- [ ] **Collaboration** — multi-user editing, version history.

---

Have an idea? Open a `feature request` issue or start a Discussion.

---

## 简体中文

### 从哪里开始

- 📖 新来？先读 [README](https://github.com/LeeShunEE/Radar-Renderer/blob/main/README.zh-CN.md) 与 [CONTRIBUTING](https://github.com/LeeShunEE/Radar-Renderer/blob/main/CONTRIBUTING.md)。
- 🟢 找第一个任务？按
  [`good first issue`](https://github.com/LeeShunEE/Radar-Renderer/labels/good%20first%20issue)
  与 [`help wanted`](https://github.com/LeeShunEE/Radar-Renderer/labels/help%20wanted)
  标签筛选。
- 💬 提问 / 想法？请用
  [Discussions](https://github.com/LeeShunEE/Radar-Renderer/discussions)，
  不要开 issue。
- 🔒 安全问题？见 [SECURITY.md](https://github.com/LeeShunEE/Radar-Renderer/blob/main/SECURITY.md)，请私下报告。
- 🤝 行为准则？见 [CODE_OF_CONDUCT.md](https://github.com/LeeShunEE/Radar-Renderer/blob/main/CODE_OF_CONDUCT.md)，友善与互相尊重。

### 现状

项目处于 **1.0 之前**。前端（Next.js + Remotion）最成熟；后端（FastAPI）活跃开发中。

### 路线图（粗粒度）

> 持续演进的文档，顺序与范围可能调整。大改动前请先在 Discussions 讨论。

#### 第一阶段：核心基础（当前）

- [ ] **后端 MVP** —— 鉴权、存储、服务端渲染流水线加固。
- [ ] **渲染体验** —— 预设面板、导出选项、性能调优。
- [ ] **文档** —— 架构概览、API 参考、部署指南。
- [ ] **测试深度** —— 拓宽 dev-integration 覆盖；稳定 Playwright e2e。
- [ ] **首个 tag 发布** —— 后端 MVP + 文档就绪后发 `v0.1.0`。

#### 第二阶段：视觉增强功能

下一阶段规划三大视觉功能，详见关联 issue。

##### 2.1 左右对比模式

> Issue: #17

扩展现有对比系统（`ComparisonPairConfig`），支持左右并排显示而非当前的前后过渡。

**关键改动：**
- 对比配置新增 `layout: 'transition' | 'side-by-side'`
- 创建 `SideBySideLayer` 组件实现并排布局
- 双图表标签定位与碰撞避让
- 同时播放时的动画同步

**验收标准：**
- 用户可选择过渡（A → B）或并排（A | B）模式
- 并排模式保持所有现有样式选项
- 标签自动避让，最小间距有验证

##### 2.2 背景媒体支持

> Issue: #18

支持图片和视频作为背景，替代当前仅 CSS 渐变的 `BackgroundGradient` 系统。

**关键改动：**
- 背景配置扩展为 `type: 'gradient' | 'image' | 'video'`
- 新增 `BackgroundMedia` 组件封装 Remotion `<Image>` / `<Video>`
- 背景视频播放控制（loop、muted、playbackRate）
- vignette 遮罩层与媒体背景兼容

**验收标准：**
- 用户可上传/选择背景媒体文件
- 媒体背景与雷达叠加层正确渲染
- 视频背景在 1080p 以内性能可接受

##### 2.3 独立视频页与色键效果

> Issue: #19 —— ✅ 已实现

多页时间轴中混排独立视频页与雷达页，支持绿幕/蓝幕抠像，使用 `@remotion/effects` 包。

**关键改动：**
- `pages` 变为雷达页与视频页（`VideoPageSchema`）的 union；
  旧配置无 `pageType` 自动回退雷达页，零迁移
- 新增 `VideoPage` 合成：主视频（fit / 音频控制）+ 色键
  （`@remotion/effects`）+ 底衬背景媒体
- 绿幕/蓝幕预设 + 自定义键色，相似度/平滑度/溢色抑制三滑杆
- 相邻视频页可重叠播放（帧偏移 + 上下层选择），
  典型场景：抠像人物叠在上一段画面之上
- 编辑器支持：添加/配置视频页、重叠配对面板、单页预览、多页导出

**验收标准：**
- 用户可在雷达页之间自由添加、排序视频页
- 绿幕/蓝幕视频正确抠像，阈值可配置
- 相邻视频片段重叠时时序与层级正确渲染

#### 第三阶段：平台与集成

- [ ] **插件系统** —— 自定义图层类型、效果扩展。
- [ ] **云端渲染** —— 分布式渲染队列、进度追踪。
- [ ] **协作功能** —— 多用户编辑、版本历史。

---

有想法？开 `feature request` issue 或发起 Discussion。