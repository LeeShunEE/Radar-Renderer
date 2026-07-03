# 独立视频页与色键效果（Issue #19）实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 页面序列从「仅雷达页」扩展为「雷达页 + 独立视频页」混排，视频页支持色键（Chroma Key）抠像与底衬背景，相邻两个视频页可按帧偏移重叠播放并指定上下层，预览与服务端渲染两端一致。

**Architecture:** `MultiPageSchema.pages` 从 `RadarVideoSchema[]` 演进为 `z.union([VideoPageSchema, RadarVideoSchema])[]`（视频页带判别字段 `pageType: "video"`，旧配置无该字段自然回落雷达页，零迁移）。新建 `VideoPage` 渲染组件（`@remotion/media` `<Video>` + `@remotion/effects` `colorKey`），接入 `MultiPageVideo` 的 Sequence 编排与 `Root` 的时长计算。相邻视频页重叠沿用 `comparisons` 的「相邻页配对」惯用法，新增 `videoOverlaps` 配对数组（帧偏移 + 上下层）。媒体上传/预览 blob 替换/渲染端 URL 改写全部复用 #18 已落地的**按值匹配**管线，后端零改动。

**Tech Stack:** Next.js 15 / React 19 / Remotion 4.0.481（`@remotion/media`、新增 `@remotion/effects`）/ Zod / Vitest + Testing Library；pnpm。后端不动。

**前置必读：** `CLAUDE.md`（三阶测试、1:1 镜像、覆盖率门槛、commit 规范）、`CONTRIBUTING.md`（分支、DCO `git commit -s`、lockfile 流程）。本计划全程 **TDD**：先写失败测试 → 跑红 → 最小实现 → 跑绿 → commit。所有 commit 带 `-s`，结尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

**分支：** `feat/video-page-chroma-key`（已从 `main` 切出），禁止直推 main。

**§13 审计说明：** 本计划不改 Docker context、Dockerfile COPY、包结构或路径折叠规则，不触发 §13 全量静态审计条件。

---

## 设计决策（Design Decisions）

### D1：页面多类型化 = pages 内联判别联合（而非独立数组）

- **选定**：`pages: z.array(z.union([VideoPageSchema, RadarVideoSchema]))`。`VideoPageSchema` 带 `pageType: z.literal("video")`；`RadarVideoSchema` **不加**任何新字段。zod union 按序尝试：有 `pageType:"video"` 命中视频页，否则命中雷达页 → **旧配置字节不动即兼容**。TS 侧用类型守卫 `isVideoPage()` 收窄。
- **否决 A**（独立 `videoPages` 数组 + 锚点索引）：与 `comparisons` 的索引重映射叠加出第二套索引语义，增删/移动页面时双重 remap 极易出错。
- **否决 B**（`z.discriminatedUnion`）：要求判别字段在所有成员上存在，雷达页需补 `pageType:"radar"`，旧配置须迁移，违背零迁移目标。

### D2：comparison 配对语义

配对仍按 `firstPageIndex`/`secondPageIndex` 指向 `pages` 的**物理位置**（与现状一致，`remapComparisons` 无需改）。新增约束：**配对仅在相邻两页都是雷达页时生效**——`buildRenderSequence` 与 `Root.calculateMetadata` 在任一侧是视频页时忽略该配对；编辑器 `ComparisonConfigPanel` 不提供含视频页的配对选项。

### D3：色键实现 = `@remotion/effects` colorKey（已验证存在）

- `colorKey({ keyColor, similarity, smoothness, spillSuppression })`，各参数 0–1，默认 `#00ff00`/0.18/0.08/0.25；要求 Remotion ≥ **4.0.472**（仓库钉 4.0.481 ✅）。
- 通过 `effects` prop 挂在 `@remotion/media` 的 `<Video>` 上（canvas 系组件）；`remotion` 核心的 `<OffthreadVideo>` **不支持** `effects`。
- 服务端渲染需 WebGL2：`frontend/render-worker/server.mjs:160` 已设 `chromiumOptions = { gl: "angle" }` ✅，无需改动。
- 组件内部策略（沿袭 `BackgroundMedia.tsx` 的环境分支先例）：
  - `chromaKey.enabled === true` → 预览与渲染**都**用 `@remotion/media` `<Video effects={[colorKey(...)]}>`（保证两端同一条渲染路径，结果一致）；
  - `enabled === false` → 预览用 `<OffthreadVideo>`（性能好），渲染用 `@remotion/media` `<Video>`（绕过 compositor 崩溃，先例同 BackgroundMedia）。
- **阶段 0 spike 闸门**：先装依赖并在 Studio + 一次真实渲染中验证 colorKey 生效，再进入正式开发。若 spike 失败，回退方案为 `<OffthreadVideo onVideoFrame>`（≥4.0.190）手写 canvas 抠像，需重估工作量并更新本计划。

### D4：视频页时长持久化在配置中

`Root.calculateMetadata` 必须**同步**算总时长 → 视频页 `durationInFrames` 直接存配置。编辑器选中素材时用 `HTMLVideoElement` 探测 `duration` 自动填充（`AssetSelector.tsx:20` 已有同类探测先例），用户可手改。不引入运行时异步 `parseMedia`。

### D5：音频

视频页自带音轨由 `<Video muted={audio.muted} volume={audio.volume}>` 直接承载（默认不静音、音量 1）；全局 BGM（`MultiPageVideo` 顶层 `<Audio>`）照常铺满全片，两者天然混音。预览分支的 `<OffthreadVideo>` 同样支持 muted/volume。不新增混音配置（YAGNI）。

### D6：媒体管线全复用，后端零改动

- 上传/选择：复用 `AssetSelector` 的 `backgrounds` 类目（已接受 `image/*,video/*`、有视频缩略预览、支持 mp4/webm/mov）。不新建类目。
- 预览鉴权：`replaceUploadsInProps`（`frontend/src/lib/replace-uploads.ts`）按值匹配任意字段的 uploads URL → 视频页 `src` 自动 blob 化，**零改动**。
- 渲染鉴权：`backend/app/service/silhouette_rewrite.py` 同为按值匹配递归改写，**零改动**。

### D7：alpha 透明视频（WebM/ProRes）

不做专门配置项：alpha 视频关掉色键直接播即可。阶段 0 spike 顺带验证 `@remotion/media` `<Video>` 对 VP9 alpha WebM 的透明渲染；若不支持，在 VideoPage 组件对 `.webm` 保留 `<OffthreadVideo transparent>` 渲染分支（记录到 spike 结论再定，不预先实现）。

### D8：视频重叠 = 相邻视频页配对数组（镜像 comparisons 惯用法）

- **需求**：两个视频可重叠播放——第二个视频相对第一个视频起点延迟 `offsetFrames` 帧进入，两者在重叠区间同屏，且可指定谁在上层（典型场景：上层绿幕人物开色键叠在下层素材画面上）。
- **选定**：`MultiPageSchema` 新增 `videoOverlaps: z.array(VideoOverlapPairSchema).default([])`，配对**相邻两个视频页**（`secondPageIndex === firstPageIndex + 1`，且两页都是视频页）：

  ```typescript
  export const VideoOverlapPairSchema = z.object({
    firstPageIndex: z.number(),
    secondPageIndex: z.number(),
    offsetFrames: z.number().int().min(0).default(0), // 第二视频相对第一视频起点的延迟帧数
    topLayer: z.enum(["first", "second"]).default("second"), // 谁在上层
  });
  ```

- **时长**：重叠段整体时长 = `max(dur1, offsetFrames + dur2)`；`offsetFrames > dur1` 时中间留空档（合法，公式天然覆盖）。
- **渲染**：`buildRenderSequence` 把配对合并为一个 `{ type: "videoOverlap" }` RenderItem，外层 Sequence 内嵌两个子 Sequence（first 从 0 起、second 从 `offsetFrames` 起），`topLayer` 决定 JSX 渲染顺序（后渲染者在上，AbsoluteFill 天然堆叠，不必显式 zIndex）。
- **守卫**：任一侧不是视频页、或不相邻 → 配对被忽略（渲染 / 时长 / 编辑器候选三端一致，同 D2）。`comparisons`（仅雷达对）与 `videoOverlaps`(仅视频对) 作用对象互斥，无冲突可能。
- **索引重映射**：增删/移动/复制页面时与 `comparisons` 同规则，把 `RadarEditor.remapComparisons` 泛化为对两个数组通用的 `remapIndexPairs`。
- **否决 A**（视频页自带 `startOffsetFrames` 负偏移字段）：语义上允许与任意前页（含雷达页）重叠，时长计算与编辑器交互复杂化；且"谁在上层"本质是成对属性，放单页字段别扭。
- **否决 B**（自由时间轴/任意多层 track）：远超需求（明确是"两个视频"成对重叠），编辑器复杂度陡增，YAGNI。
- **音频**：重叠区间两条音轨自然混音（各自 `audio.muted/volume` 可独立控制），不新增混音配置。
- **向后兼容**：`videoOverlaps` 带 `.default([])`，旧配置零迁移。

---

## 阶段总览

| 阶段 | 内容 | 产物可用性 |
| - | - | - |
| 0 | spike 闸门：装 `@remotion/effects`，Studio + 真实渲染验证 colorKey 与 alpha WebM | 技术路线确认 |
| 1 | 数据层：`VideoPageSchema` + union + 类型守卫 + `VideoOverlapPairSchema` + 时长函数 | 配置可存取，渲染未变 |
| 2 | 渲染层：`VideoPage` 组件 + `MultiPageVideo` 编排（含重叠合并）+ `Root` 时长 | 手改 JSON 可渲染含视频页/重叠段的成片 |
| 3 | 编辑器：添加/配置/排序视频页 + 重叠配对面板 + 配对/数值/覆写面板兼容 + 预览 | 用户可视化完成全流程 |
| 4 | 收尾：ROADMAP/文档更新、全量测试 + 覆盖率、testenv e2e | 交付 |

---

## 阶段 0 — Spike 闸门（不写产品代码）

### Task 0.1：安装 `@remotion/effects` 并验证

**Files:**
- Modify: `frontend/package.json`（`dependencies` 增 `"@remotion/effects": "4.0.481"`）
- Modify: `frontend/pnpm-lock.yaml`（由 pnpm 生成，禁手改）

**Step 1: 安装依赖**

```bash
cd frontend && pnpm add @remotion/effects@4.0.481
```

**Step 2: Studio 手工验证（临时代码，不提交）**

在 `Root.tsx` 临时挂一个用绿幕测试素材的 `<Video effects={[colorKey({})]}>` composition，`pnpm remotion` 打开 Studio 确认：绿幕被抠掉、similarity/smoothness 调参有响应。绿幕素材可用任意公开 sample（仅本地验证用，不进 git）。

**Step 3: 服务端渲染验证**

对同一临时 composition 跑一次 `pnpm exec remotion render`（或经 render-worker 走一次），确认导出的 mp4 中抠像结果与预览一致（`gl: "angle"` 生效）。同时用一段 VP9 alpha WebM 验证 D7（透明是否直渲）。

**Step 4: 记录结论并回滚临时代码**

把 spike 结论（colorKey 两端是否一致、alpha WebM 是否直渲、性能观感）追加到本文档「Spike 结论」小节。`git checkout` 回滚临时 composition。

**Step 5: Commit（仅依赖变更）**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml docs/plans/2026-07-03-video-page-chroma-key.md
git commit -s -m "chore(deps): 引入 @remotion/effects 4.0.481 支持色键抠像"
```

> **闸门**：若 Step 2/3 失败（colorKey 不可用或两端不一致），停止执行本计划后续阶段，按 D3 回退方案修订计划。

---

## 阶段 1 — 数据层

### Task 1.1：`VideoPageSchema` + `PageSchema` union + 类型守卫

**Files:**
- Modify: `frontend/src/types/radar.ts`
- Test: `tests/unit/frontend/types/radar.test.ts`（已存在，追加 describe）

**Step 1: 写失败测试**

在 `tests/unit/frontend/types/radar.test.ts` 追加：

```typescript
import { PageSchema, VideoPageSchema, isVideoPage, MultiPageSchema } from "@/types/radar";

describe("VideoPageSchema", () => {
  it("解析最小视频页配置并填默认值", () => {
    const parsed = VideoPageSchema.parse({ pageType: "video", src: "/api/v1/files/uploads/a.mp4" });
    expect(parsed.durationInFrames).toBe(150);
    expect(parsed.fit).toBe("contain");
    expect(parsed.audio).toEqual({ muted: false, volume: 1 });
    expect(parsed.chromaKey.enabled).toBe(false);
    expect(parsed.chromaKey.keyColor).toBe("#00ff00");
    expect(parsed.background.type).toBe("gradient");
  });

  it("色键参数越界被拒绝", () => {
    expect(() =>
      VideoPageSchema.parse({ pageType: "video", src: "a.mp4", chromaKey: { similarity: 1.5 } }),
    ).toThrow();
  });
});

describe("PageSchema union 向后兼容", () => {
  it("无 pageType 的旧雷达页解析为雷达页", () => {
    const parsed = PageSchema.parse(defaultRadarProps); // 复用现有 fixture/defaultRadarProps
    expect(isVideoPage(parsed)).toBe(false);
  });

  it("pageType=video 解析为视频页", () => {
    const parsed = PageSchema.parse({ pageType: "video", src: "a.mp4" });
    expect(isVideoPage(parsed)).toBe(true);
  });

  it("MultiPageSchema 接受雷达页与视频页混排", () => {
    const cfg = MultiPageSchema.parse({
      pages: [defaultRadarProps, { pageType: "video", src: "a.mp4" }],
      musicUrl: "",
    });
    expect(cfg.pages).toHaveLength(2);
    expect(isVideoPage(cfg.pages[1])).toBe(true);
  });
});
```

**Step 2: 跑红**

```bash
cd frontend && pnpm test:unit -- radar.test
```
Expected: FAIL（`VideoPageSchema` 未导出）

**Step 3: 最小实现**

在 `frontend/src/types/radar.ts` 的 `RadarVideoSchema` 之后新增：

```typescript
export const ChromaKeySchema = z.object({
  enabled: z.boolean().default(false),
  keyColor: z.string().default("#00ff00"),
  similarity: z.number().min(0).max(1).default(0.18),
  smoothness: z.number().min(0).max(1).default(0.08),
  spillSuppression: z.number().min(0).max(1).default(0.25),
});

export const VideoPageSchema = z.object({
  pageType: z.literal("video"),
  label: z.string().default("视频页"),
  src: z.string().default(""),
  durationInFrames: z.number().int().min(1).max(18000).default(150),
  fit: z.enum(["contain", "cover", "fill"]).default("contain"),
  audio: z
    .object({
      muted: z.boolean().default(false),
      volume: z.number().min(0).max(1).default(1),
    })
    .default({ muted: false, volume: 1 }),
  chromaKey: ChromaKeySchema.default({}),
  background: BackgroundSchema, // 抠像后的底衬，复用 #18
});

export type VideoPageConfig = z.infer<typeof VideoPageSchema>;

// union 顺序敏感：VideoPageSchema 在前（靠 pageType 判别），雷达页兜底。
export const PageSchema = z.union([VideoPageSchema, RadarVideoSchema]);
export type PageConfig = z.infer<typeof PageSchema>;

export function isVideoPage(page: PageConfig): page is VideoPageConfig {
  return "pageType" in page && page.pageType === "video";
}
```

并把 `MultiPageSchema` 的 `pages: z.array(RadarVideoSchema)` 改为 `pages: z.array(PageSchema)`。

**Step 4: 跑绿 + 全量类型检查**

```bash
cd frontend && pnpm test:unit -- radar.test && pnpm exec tsc --noEmit
```

> `tsc --noEmit` 预计暴露一批下游类型错误（`MultiPageVideo`、`RadarEditor` 等把 `pages[i]` 当 `RadarVideoProps` 用）。**本 Task 只修类型层面的最小适配**（在消费点先用 `isVideoPage` 守卫 + 显式收窄，行为不变：视频页此时可被解析但渲染端按后续 Task 落地）。若适配量大，允许在本 Task 内拆多次 commit。

**Step 5: Commit**

```bash
git add frontend/src/types/radar.ts tests/unit/frontend/types/radar.test.ts <其余适配文件>
git commit -s -m "feat(types): 页面序列支持视频页判别联合 VideoPageSchema"
```

### Task 1.2：默认值与时长函数

**Files:**
- Modify: `frontend/src/types/constants.ts`
- Test: `tests/unit/frontend/types/constants.test.ts`（存在则追加，否则新建）

**Step 1: 写失败测试**

```typescript
import { defaultVideoPage, calculatePageDuration } from "@/types/constants";
import { isVideoPage } from "@/types/radar";

describe("defaultVideoPage", () => {
  it("是合法的视频页配置", () => {
    expect(isVideoPage(defaultVideoPage)).toBe(true);
    expect(defaultVideoPage.src).toBe("");
  });
});

describe("calculatePageDuration", () => {
  it("雷达页走动画时长", () => {
    expect(calculatePageDuration(defaultRadarProps)).toBe(calculateDuration(defaultRadarProps.animation));
  });
  it("视频页直接取 durationInFrames", () => {
    expect(calculatePageDuration({ ...defaultVideoPage, durationInFrames: 240 })).toBe(240);
  });
});
```

**Step 2: 跑红** `cd frontend && pnpm test:unit -- constants.test` → FAIL

**Step 3: 最小实现**

`constants.ts` 新增：

```typescript
export const defaultVideoPage: z.infer<typeof VideoPageSchema> = VideoPageSchema.parse({
  pageType: "video",
});

export function calculatePageDuration(page: z.infer<typeof PageSchema>): number {
  return isVideoPage(page) ? page.durationInFrames : calculateDuration(page.animation);
}
```

**Step 4: 跑绿** 同上命令 → PASS

**Step 5: Commit**

```bash
git add frontend/src/types/constants.ts tests/unit/frontend/types/constants.test.ts
git commit -s -m "feat(types): 视频页默认值与统一页面时长计算"
```

### Task 1.3：`VideoOverlapPairSchema` 与重叠时长函数

**Files:**
- Modify: `frontend/src/types/radar.ts`（新增 `VideoOverlapPairSchema`；`MultiPageSchema` 增 `videoOverlaps` 字段）
- Modify: `frontend/src/types/constants.ts`（新增 `calculateVideoOverlapDuration`）
- Test: `tests/unit/frontend/types/radar.test.ts`、`tests/unit/frontend/types/constants.test.ts`（追加）

**Step 1: 写失败测试**

```typescript
// radar.test.ts 追加
describe("VideoOverlapPairSchema", () => {
  it("默认 offsetFrames=0、topLayer=second", () => {
    const parsed = VideoOverlapPairSchema.parse({ firstPageIndex: 1, secondPageIndex: 2 });
    expect(parsed.offsetFrames).toBe(0);
    expect(parsed.topLayer).toBe("second");
  });
  it("负 offsetFrames 被拒绝", () => {
    expect(() => VideoOverlapPairSchema.parse({ firstPageIndex: 1, secondPageIndex: 2, offsetFrames: -1 })).toThrow();
  });
  it("MultiPageSchema 无 videoOverlaps 时回落空数组（旧配置兼容）", () => {
    const cfg = MultiPageSchema.parse({ pages: [defaultRadarProps], musicUrl: "" });
    expect(cfg.videoOverlaps).toEqual([]);
  });
});

// constants.test.ts 追加
describe("calculateVideoOverlapDuration", () => {
  it("offset + dur2 更长时取第二段末尾", () => {
    expect(calculateVideoOverlapDuration(100, 200, { offsetFrames: 60 })).toBe(260);
  });
  it("第一段更长时取第一段末尾", () => {
    expect(calculateVideoOverlapDuration(300, 100, { offsetFrames: 60 })).toBe(300);
  });
  it("offset 超过 dur1 留空档也合法", () => {
    expect(calculateVideoOverlapDuration(100, 100, { offsetFrames: 150 })).toBe(250);
  });
});
```

**Step 2: 跑红** `cd frontend && pnpm test:unit -- --run radar.test constants.test` → FAIL

**Step 3: 最小实现**

`radar.ts`（D8 的 schema 原文）+ `MultiPageSchema` 增 `videoOverlaps: z.array(VideoOverlapPairSchema).default([])`；`constants.ts`：

```typescript
export function calculateVideoOverlapDuration(
  dur1: number,
  dur2: number,
  overlap: Pick<z.infer<typeof VideoOverlapPairSchema>, "offsetFrames">,
): number {
  return Math.max(dur1, overlap.offsetFrames + dur2);
}
```

**Step 4: 跑绿** → PASS

**Step 5: Commit**

```bash
git add frontend/src/types/radar.ts frontend/src/types/constants.ts tests/unit/frontend/types/
git commit -s -m "feat(types): 视频页重叠配对 schema 与重叠时长计算"
```

---

## 阶段 2 — 渲染层

### Task 2.1：`VideoPage` 渲染组件

**Files:**
- Create: `frontend/src/remotion/VideoPage.tsx`
- Test: `tests/unit/frontend/remotion/VideoPage.test.tsx`（新建）

**Step 1: 写失败测试**

参照 `tests/unit/frontend/remotion/Effects/BackgroundMedia.test.tsx` 的 mock 手法（`@remotion/media` 已在 vitest alias 中配置；`@remotion/effects` 需同样 mock，若 alias 未覆盖则在 `frontend/vitest.config.ts` 补 `resolve.alias`——先例见仓库 memory「vi.mock 需 vitest alias」）：

```tsx
vi.mock("@remotion/effects/color-key", () => ({
  colorKey: vi.fn((opts) => ({ __effect: "colorKey", ...opts })),
}));

describe("VideoPage", () => {
  it("src 为空渲染占位不渲染视频", () => { /* queryByTestId("video-page-video") 为 null */ });
  it("色键关闭 + 预览环境使用 OffthreadVideo（无 effects）", () => { /* mock useRemotionEnvironment isRendering:false */ });
  it("色键开启时使用 @remotion/media Video 且传入 colorKey effects", () => {
    /* 断言 colorKey 被以 { keyColor, similarity, smoothness, spillSuppression } 调用，
       Video 收到 effects 数组 */
  });
  it("audio.muted/volume 透传", () => { /* 断言 muted/volume props */ });
  it("底衬背景按 background.type 分发", () => { /* gradient → 无 BackgroundMedia；video/image → BackgroundMedia 出现 */ });
});
```

**Step 2: 跑红** `cd frontend && pnpm test:unit -- VideoPage.test` → FAIL（组件不存在）

**Step 3: 最小实现**

`frontend/src/remotion/VideoPage.tsx`（骨架，环境分支与 `resolveSrc` 逻辑沿袭 `Effects/BackgroundMedia.tsx`）：

```tsx
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useRemotionEnvironment } from "remotion";
import { Video } from "@remotion/media";
import { colorKey } from "@remotion/effects/color-key";
import { BackgroundMedia } from "./Effects/BackgroundMedia";
import { isRemoteSilhouetteSrc } from "./CharacterSilhouette/Silhouette";
import type { VideoPageConfig } from "../types/radar";

export const VideoPage: React.FC<{ page: VideoPageConfig }> = ({ page }) => {
  const env = useRemotionEnvironment();
  const { background, chromaKey, audio, fit } = page;

  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: fit };
  const src = page.src ? (isRemoteSilhouetteSrc(page.src) ? page.src : staticFile(page.src)) : "";

  const effects = chromaKey.enabled
    ? [colorKey({
        keyColor: chromaKey.keyColor,
        similarity: chromaKey.similarity,
        smoothness: chromaKey.smoothness,
        spillSuppression: chromaKey.spillSuppression,
      })]
    : undefined;

  // 色键必须走 canvas 系 <Video>（effects prop 仅它支持）；
  // 无色键时沿袭 BackgroundMedia 先例：预览 OffthreadVideo / 渲染 Video。
  const useMediaVideo = chromaKey.enabled || env.isRendering;

  return (
    <AbsoluteFill>
      {background.type !== "gradient" && background.media ? (
        <BackgroundMedia type={background.type} media={background.media} />
      ) : null}
      {src ? (
        useMediaVideo ? (
          <Video data-testid="video-page-video" src={src} effects={effects}
                 muted={audio.muted} volume={audio.volume} style={style} />
        ) : (
          <OffthreadVideo data-testid="video-page-video" src={src}
                          muted={audio.muted} volume={audio.volume} style={style} />
        )
      ) : null}
    </AbsoluteFill>
  );
};
```

> 注：`background.type === "gradient"` 时视频页底为透明/黑底即可（雷达页的渐变背景组件绑定 theme，视频页不复用；若产品上需要渐变底衬再补——YAGNI）。gradient 分发细节以实现时 `RadarVideo` 现状为准。

**Step 4: 跑绿** 同上命令 → PASS

**Step 5: Commit**

```bash
git add frontend/src/remotion/VideoPage.tsx tests/unit/frontend/remotion/VideoPage.test.tsx frontend/vitest.config.ts
git commit -s -m "feat(remotion): 新增 VideoPage 组件支持色键抠像与底衬背景"
```

### Task 2.2：`MultiPageVideo` 编排接入

**Files:**
- Modify: `frontend/src/remotion/MultiPageVideo.tsx`
- Test: `tests/unit/frontend/remotion/MultiPageVideo.test.tsx`（存在则追加，否则新建）

**Step 1: 写失败测试**

覆盖场景（mock `VideoPage`/`RadarVideo` 断言 Sequence 编排）：

1. `[radar, video, radar]` → 三个 Sequence，中间为 VideoPage，`from` 依次累加，video 时长 = `durationInFrames`
2. `[radar, radar]` + 配对 → 现状不回归（单 Sequence 对比）
3. `[radar, video]` + 配对 `(0,1)` → 配对被忽略，输出两个独立 Sequence
4. 视频页不经过 `applyGlobalOverride`（mock 后断言未被调用于视频页）
5. `[video(100), video(200)]` + 重叠 `(0,1,offset=60)` → **单个**外层 Sequence 时长 260，内含两个子 Sequence（first from 0 / second from 60）
6. 重叠 `topLayer:"first"` → first 的 VideoPage 在 JSX 中后渲染（DOM 顺序断言，上层在后）；`topLayer:"second"`（默认）反之
7. `[radar, video]` + 重叠 `(0,1)` → 任一侧非视频页，重叠被忽略，两个独立 Sequence
8. `[video, video]` 同一对同时出现在 `comparisons` 与 `videoOverlaps` → comparison 因非雷达页被忽略，overlap 生效（互斥守卫）

**Step 2: 跑红** `pnpm test:unit -- MultiPageVideo.test` → FAIL

**Step 3: 最小实现**

`MultiPageVideo.tsx` 关键改动：

```typescript
type RenderItem =
  | { type: "single"; page: RadarVideoProps; duration: number }
  | { type: "video"; page: VideoPageConfig; duration: number }
  | { type: "videoOverlap"; first: VideoPageConfig; second: VideoPageConfig;
      config: VideoOverlapPairConfig; duration: number }
  | { type: "comparison"; /* 现状不变 */ };

// buildRenderSequence 内：
const mergedPages = config.pages.map((p) =>
  isVideoPage(p) ? p : applyGlobalOverride(p, config.globalOverride),
);
const overlapMap = new Map<number, VideoOverlapPairConfig>();
for (const ov of config.videoOverlaps) overlapMap.set(ov.firstPageIndex, ov);

for (let i = 0; i < config.pages.length; i++) {
  if (compared.has(i)) continue;
  const cur = mergedPages[i];
  const next = i + 1 < mergedPages.length ? mergedPages[i + 1] : undefined;
  if (isVideoPage(cur)) {
    const ov = overlapMap.get(i);
    if (ov && next && isVideoPage(next) && ov.secondPageIndex === i + 1) {
      items.push({
        type: "videoOverlap", first: cur, second: next, config: ov,
        duration: calculateVideoOverlapDuration(cur.durationInFrames, next.durationInFrames, ov),
      });
      compared.add(i); compared.add(i + 1);
    } else {
      items.push({ type: "video", page: cur, duration: cur.durationInFrames });
    }
    continue;
  }
  const comp = compMap.get(i);
  if (comp && next && !isVideoPage(next)) {
    /* 现状对比分支 */
  } else {
    /* 现状 single 分支 */
  }
}

// JSX：
// item.type === "video" → <VideoPage page={item.page} />
// item.type === "videoOverlap" → 外层 Sequence 内：
//   const layers = [
//     <Sequence key="first" from={0} durationInFrames={dur1}><VideoPage page={item.first} /></Sequence>,
//     <Sequence key="second" from={item.config.offsetFrames} durationInFrames={dur2}><VideoPage page={item.second} /></Sequence>,
//   ];
//   item.config.topLayer === "first" ? [layers[1], layers[0]] : layers
//   （AbsoluteFill 天然按 DOM 顺序堆叠，后渲染者在上，无需 zIndex）
```

**Step 4: 跑绿** → PASS

**Step 5: Commit**

```bash
git commit -s -m "feat(remotion): MultiPageVideo 支持视频页编排与配对守卫"
```

### Task 2.3：`Root.calculateMetadata` 总时长

**Files:**
- Modify: `frontend/src/remotion/Root.tsx`
- Test: `tests/unit/frontend/remotion/Root.test.tsx`（存在则追加，否则新建；若 calculateMetadata 难以直接单测，把该循环抽成 `calculateMultiPageTotalFrames(config)` 放进 `constants.ts` 并测它，`Root` 与 `MultiPageVideo` 共用——顺带消除现存的双份重复逻辑，DRY）

**Step 1: 写失败测试**（对抽出的 `calculateMultiPageTotalFrames`）

1. `[radar, video(240), radar]` → 三段之和
2. `[radar, video]` + 配对 `(0,1)` → 配对忽略，两段之和
3. 纯雷达 + 配对 → 与现状 `calculateComparisonDuration` 结果一致（回归）
4. `[video(100), video(200)]` + 重叠 `(0,1,offset=60)` → 总长 260（与 Task 2.2 场景 5 的编排一致）
5. `[radar, video(100), video(200), radar]` + 重叠 `(1,2,offset=60)` → radar + 260 + radar

**Step 2: 跑红** → FAIL

**Step 3: 实现**：抽公共函数，`Root.tsx` 与 `MultiPageVideo.buildRenderSequence` 调用同一时长逻辑。

**Step 4: 跑绿 + 手工冒烟**

```bash
cd frontend && pnpm test:unit && pnpm exec tsc --noEmit
```
手工：构造含视频页的 JSON 走 Studio 预览一次（真实素材路径），确认时长与画面正确。

**Step 5: Commit**

```bash
git commit -s -m "feat(remotion): 统一多页总时长计算并纳入视频页"
```

---

## 阶段 3 — 编辑器

### Task 3.1：`RadarEditor` 状态层支持视频页（添加/更新/增删排序兼容）

**Files:**
- Modify: `frontend/src/components/editor/RadarEditor.tsx`
- Test: `tests/unit/frontend/components/editor/RadarEditor.test.tsx`（存在则追加，否则新建）

**Step 1: 写失败测试**

1. `addVideoPage` 在末尾追加 `defaultVideoPage`
2. `updateVideoPage(i, { durationInFrames: 300 })` 只改目标页
3. `removePage`/`movePage`/`duplicatePage` 对视频页可用，`remapComparisons` 行为不回归（副本命名对视频页用 `label` 而非 `characterName`）
4. `activePage` 为视频页时 `playerProps`（雷达 override 合并）不被调用/不崩溃
5. 增删/移动/复制页面时 `videoOverlaps` 索引与 `comparisons` 同步重映射（把 `remapComparisons` 泛化为 `remapIndexPairs`，两个数组共用；删除任一侧页面 → 该重叠对被移除）

**Step 2: 跑红** → **Step 3: 实现**要点：

- `pages` 类型改 `PageConfig[]`；`updatePage` 保持雷达签名，新增 `updateVideoPage(index, updates: Partial<VideoPageConfig>)`
- `addVideoPage = () => setConfig(prev => ({ ...prev, pages: [...prev.pages, { ...defaultVideoPage, label: `视频${n}` }] }))`
- `duplicatePage` 对视频页复制 `label + " (副本)"`
- 单页预览：activePage 是视频页时 `previewMode==="single"` 的 props 改走 VideoPage（见 Task 3.4）

**Step 4: 跑绿** → **Step 5: Commit**

```bash
git commit -s -m "feat(editor): 编辑器状态层支持视频页增删改排序"
```

### Task 3.2：`VideoPageConfigPanel` 配置面板

**Files:**
- Create: `frontend/src/components/editor/VideoPageConfigPanel.tsx`
- Modify: `frontend/src/components/editor/RadarEditor.tsx`（pages tab 按 `isVideoPage` 分发面板）、`GlobalConfigEditor.tsx`（页面列表显示视频页 + 「添加视频页」按钮）
- Test: `tests/unit/frontend/components/editor/VideoPageConfigPanel.test.tsx`（新建）

**面板内容**：

- 素材选择：`<AssetSelector category="backgrounds">`（仅接受视频文件名 `.mp4/.webm/.mov`）；选中后**自动探测时长**回填 `durationInFrames`：

```typescript
function probeDurationInFrames(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(Math.max(1, Math.round(v.duration * VIDEO_FPS)));
    v.onerror = () => resolve(null);
    v.src = url;
  });
}
```

- 基础：`label`、`durationInFrames`（数字输入，可手改）、`fit`（三选）、`audio.muted` / `audio.volume`
- 色键区：`enabled` 开关；预设按钮「绿幕 #00ff00 / 蓝幕 #0000ff / 自定义(取色器)」写 `keyColor`；`similarity` / `smoothness` / `spillSuppression` 三个 0–1 滑杆
- 底衬背景：复用/参照 `BackgroundConfigPanel` 的接入方式配置 `background`

**测试覆盖**：面板渲染各控件、onUpdate 回调载荷正确、时长探测回填（mock HTMLVideoElement）、色键预设点击写入正确颜色。

**TDD 步骤同前** → Commit：

```bash
git commit -s -m "feat(editor): 视频页配置面板（素材/时长/色键/底衬）"
```

### Task 3.3：配对 / 数值 / 全局覆写面板兼容

**Files:**
- Modify: `frontend/src/components/editor/ComparisonConfigPanel.tsx`（配对候选剔除视频页及跨视频页的相邻对）
- Modify: `frontend/src/components/editor/RadarValuesTable.tsx`（跳过视频页行，显示只读占位「视频页」）
- Modify: `frontend/src/components/editor/GlobalOverridePanel.tsx` / `GlobalConfigEditor.tsx`（覆写仅作用于雷达页；页面列表区分类型图标/标签）
- Test: 对应各 `.test.tsx` 追加 describe

**TDD 步骤同前** → Commit：

```bash
git commit -s -m "feat(editor): 配对/数值/覆写面板兼容视频页"
```

### Task 3.3b：`VideoOverlapConfigPanel` 视频重叠配对面板

**Files:**
- Create: `frontend/src/components/editor/VideoOverlapConfigPanel.tsx`
- Modify: `frontend/src/components/editor/RadarEditor.tsx`（挂到「对比」tab，与 `ComparisonConfigPanel` 并列——两者语义同为"相邻页配对"）
- Test: `tests/unit/frontend/components/editor/VideoOverlapConfigPanel.test.tsx`（新建）

**面板内容**（交互样式参照 `ComparisonConfigPanel`）：

- 候选列表：枚举所有**相邻视频页对**（`pages[i]` 与 `pages[i+1]` 均为视频页），每对一行，可勾选启用重叠
- 已启用的配对展开配置：
  - `offsetFrames` 数字输入（第二视频延迟帧数，≥0；辅助显示换算秒数 `offsetFrames / VIDEO_FPS`）
  - `topLayer` 二选（「上层：第一个视频 / 第二个视频」）
  - 只读提示：重叠段总时长 = `calculateVideoOverlapDuration(...)` 实时计算展示
- 无相邻视频页对时显示空态提示（"需要两个相邻的视频页才能配置重叠"）

**测试覆盖**：候选枚举正确（混排序列只列视频相邻对）、勾选/取消写入 `videoOverlaps`、offsetFrames/topLayer 变更载荷正确、空态渲染。

**TDD 步骤同前** → Commit：

```bash
git commit -s -m "feat(editor): 视频重叠配对面板（帧偏移与上下层）"
```

### Task 3.4：预览与导出

**Files:**
- Modify: `frontend/src/components/editor/PreviewPanel.tsx`（single 模式 + 视频页 → Player 挂 `VideoPage` 组件，`durationInFrames` 取配置；multi 模式零改动——`replaceUploadsInProps` 已按值覆盖视频页 src）
- Modify: `frontend/src/components/editor/ExportPanel.tsx`（single 导出遇视频页时禁用并提示改用多页导出；multi 导出零改动）
- Test: 对应 `.test.tsx` 追加

**TDD 步骤同前**；跑绿后**手工验证一次全链路**（dev 栈 `docker compose ... up -d --build` 后浏览器真开页面，见 memory「redeploy 必须重建镜像」）：上传绿幕视频 → 添加视频页 → 开色键调参预览 → 多页导出 → 检查产物。Commit：

```bash
git commit -s -m "feat(editor): 视频页预览与导出链路"
```

---

## 阶段 4 — 收尾

### Task 4.1：文档同步

**Files:**
- Modify: `ROADMAP.md`（2.3 节改为「独立视频页 + 色键」描述，中英两处）
- Modify: `CHANGELOG.md`（Unreleased 追加条目）

```bash
git commit -s -m "docs: ROADMAP 2.3 与 CHANGELOG 同步视频页功能描述"
```

### Task 4.2：全量测试 + 覆盖率门槛

```bash
cd frontend && pnpm test:unit && pnpm test:integration
```

要求 100% 通过、前端总覆盖率 ≥ 60% 且每文件 ≥ 50%（`VideoPage.tsx`、`VideoPageConfigPanel.tsx` 重点确认）。后端无改动，跑一次 `cd backend && uv run pytest ../tests/unit/backend/ -v` 确认无意外破坏。

### Task 4.3：testenv e2e（复杂任务完成自动跑一次）

**Files:**
- Create: `tests/testenv-integration/frontend/video-page-chroma-key.spec.ts`（按旅程命名，§2.6 豁免镜像）

旅程：登录（dev/dev12345，TESTING seed）→ 上传绿幕测试视频（`tests/data/frontend/` 放小体积样例，注意不超大）→ 添加视频页 → 开启色键 → 预览 → 提交渲染任务 → 轮询任务完成。运行：

```bash
cd frontend && pnpm exec playwright test tests/testenv-integration/frontend/video-page-chroma-key.spec.ts
```

```bash
git commit -s -m "test(e2e): 视频页色键用户旅程 testenv 用例"
```

### Task 4.4：收尾提交与 PR

pre-push 全套通过后推分支，开 PR（`Closes #19`），PR 描述附 spike 结论与手工验证记录。

---

## 风险与应对

| 风险 | 应对 |
| - | - |
| colorKey 预览/渲染结果不一致或不可用 | 阶段 0 spike 闸门前置暴露；回退 `OffthreadVideo onVideoFrame` 手写抠像并修订计划 |
| `@remotion/media` `<Video>` 在 Player 预览的性能/兼容问题 | 仅色键开启时才在预览走 `<Video>`；关闭时保持 OffthreadVideo |
| union 改动波及面大（tsc 报错扩散） | Task 1.1 Step 4 用 `tsc --noEmit` 全量暴露，逐点 `isVideoPage` 守卫收窄，允许拆多 commit |
| 旧配置/自动保存配置解析失败 | union 兜底雷达页，零迁移；radar.test.ts 显式回归用例 |
| 配对索引与视频页冲突 | D2 双端守卫（渲染 + 时长 + 编辑器候选过滤），MultiPageVideo 测试场景 3 锁定 |
| 重叠对与雷达配对/页面增删的索引联动出错 | 复用同一 `remapIndexPairs`（Task 3.1 场景 5），MultiPageVideo 场景 7/8 锁定互斥守卫 |
| 重叠区间双视频（尤其双色键）渲染性能 | spike 已测单页耗时；重叠为两层 `<Video>`，若渲染超时在 UI 提示降低分辨率，不做硬限制（YAGNI） |
| 渲染超时/性能下降 | spike 记录单视频页渲染耗时；必要时在 UI 提示视频分辨率建议（不做硬限制，YAGNI） |

## Spike 结论

> Task 0.1 于 2026-07-03 执行（无头环境，Studio 手工步骤以 `remotion still --gl=angle` 服务端渲染替代验证）。

- **colorKey 服务端渲染 ✅ 可用**：合成绿幕素材（纯绿底 + 红白方块，libx264 yuv420p）经 `@remotion/media` `<Video effects={[colorKey({})]}>` 渲染，绿底完全抠除、下层洋红底衬透出、主体边缘干净无绿边（spill suppression 默认 0.25 生效）。API 形态与计划一致：`colorKey({ keyColor, similarity, smoothness, spillSuppression })`，导出路径 `@remotion/effects/color-key`，默认值 `#00ff00`/0.18/0.08/0.25。
- **alpha WebM 直渲 ❌ 不可用**：合法的 VP9 yuva420p alpha WebM（bundled ffmpeg 反解验证素材本身无损）经 `@remotion/media` `<Video>` 渲染输出撕裂花屏（alpha 平面被误解为色度数据）。按 D7 决议：**不做专门配置**，alpha 视频场景暂不支持直渲；后续若有需求，对 `.webm` 增加 `<OffthreadVideo transparent>` 渲染分支（另行任务）。
- **性能观感**：640x360 单帧 still 渲染（含 bundle）约 30s 级，其中 bundle 占大头；colorKey 本身无显著额外耗时。
- **闸门判定**：colorKey 主路线通过，按原计划继续；D7 记录为已知限制。
