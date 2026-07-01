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

##### 2.3 Video Insert with Chroma Key Effect

> Issue: #19

Insert video clips into radar charts with green/blue screen keying support
using `@remotion/effects` package.

**Key changes:**
- Add `videoInserts` array to radar chart config
- Create `VideoInsertLayer` component with position/size/timing controls
- Integrate `@remotion/effects` `chromaKey` effect
- Provide preset configs for common green/blue screen colors

**Acceptance criteria:**
- Users can place videos at specified positions within the chart area
- Green/blue screen videos are correctly keyed with configurable thresholds
- WebM transparent videos work without chroma key processing

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

##### 2.3 视频插入与色键效果

> Issue: #19

在雷达图表中插入视频片段，支持绿幕/蓝幕抠像，使用 `@remotion/effects` 包。

**关键改动：**
- 雷达配置新增 `videoInserts` 数组字段
- 创建 `VideoInsertLayer` 组件，支持位置/尺寸/时序控制
- 集成 `@remotion/effects` 的 `chromaKey` 效果
- 提供常见绿幕/蓝幕颜色的预设配置

**验收标准：**
- 用户可在图表区域指定位置放置视频
- 绿幕/蓝幕视频正确抠像，阈值可配置
- WebM 透明视频无需色键处理即可工作

#### 第三阶段：平台与集成

- [ ] **插件系统** —— 自定义图层类型、效果扩展。
- [ ] **云端渲染** —— 分布式渲染队列、进度追踪。
- [ ] **协作功能** —— 多用户编辑、版本历史。

---

有想法？开 `feature request` issue 或发起 Discussion。