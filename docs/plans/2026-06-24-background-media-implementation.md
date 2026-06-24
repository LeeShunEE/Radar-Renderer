# 背景媒体支持（Issue #18）实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把背景系统从「仅 CSS 渐变」扩展为 `gradient | image | video` 三态，复用现有媒体上传/渲染管线，让用户用图片或视频作背景。

**Architecture:** 在 `RadarVideoSchema` 顶层新增独立 `background` 对象（vignette 仍留 `theme`，向后兼容）；新建 `BackgroundMedia`（`Img`/`OffthreadVideo`）与独立 `Vignette` 叠加组件；`RadarVideo` 背景层按 `background.type` 分发。渲染端复用 `silhouette_rewrite` 改写机制（先泛化为按值匹配让背景媒体走现有 copy，再用只读挂载做零拷贝优化）；预览端复用 `replaceUploads` blob 机制。

**Tech Stack:** Next.js 15 / React 19 / Remotion 4.0.481 / Zod / Vitest + Testing Library（前端）；FastAPI / pytest（后端）；pnpm；Docker Compose。

**前置必读：** `CLAUDE.md`（三阶测试、1:1 镜像、覆盖率门槛、commit 规范）、`CONTRIBUTING.md`（分支、DCO `git commit -s`、lockfile 流程）。本计划全程 **TDD**：先写失败测试 → 跑红 → 最小实现 → 跑绿 → commit。所有 commit 带 `-s`，结尾 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

**设计依据：** 见 `docs/plans/2026-06-24-background-media-design-decisions.md`（问题 1–9 全部决策 + 方案 A/B 验证）。

**分支：** 从 `main` 切 `feat/background-media`，禁止直推 main。

---

## 阶段总览

| 阶段 | 内容 | 产物可用性 |
| - | - | - |
| 1 | 数据层：`BackgroundSchema` + 类型 + 默认回落 | 配置可存取，渲染未变 |
| 2 | 渲染组件：`Vignette` 叠加层 + `BackgroundMedia`（**纯视觉无声**）+ `RadarVideo` 分发 | 图片/视频背景可渲染（公共素材路径） |
| 3 | 渲染端鉴权：`media_rewrite` 泛化（按值匹配，覆盖背景媒体）| 上传的背景媒体能服务端渲染 |
| 4 | 预览 + 上传：`replaceUploads` 泛化 + `AssetSelector` `backgrounds` 类 + 体积/分辨率软警告 | 上传背景媒体可预览/选择 |
| 5 | 编辑器：独立「背景」面板 + 挪入 vignette | 用户可视化配置背景 |
| 6 | 渲染端零拷贝优化：只读挂载 + copy 回退 | Docker 下背景视频零拷贝 |
| 7 | （独立子阶段，spike 闸门）背景视频音频混流 | 背景视频可出声 |

> 阶段 1–5 完成即交付「无声图片/视频背景」完整功能。阶段 6 是性能优化。阶段 7（音频）按 Q9 决策独立推进，带 spike 闸门。

---

## 阶段 1 — 数据层

### Task 1.1：新增 `BackgroundSchema` 与类型

**Files:**
- Modify: `frontend/src/types/radar.ts`（在 `RadarVideoSchema` 定义前新增 schema；在 `RadarVideoSchema` 对象内新增 `background` 字段）
- Test: `tests/unit/frontend/types/radar.test.ts`（新建）

**Step 1: 写失败测试**

新建 `tests/unit/frontend/types/radar.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { RadarVideoSchema, BackgroundSchema, defaultBackground } from "@/types/radar";
import { makeRadarProps } from "../components/editor/_fixtures"; // 见 Step 注

describe("BackgroundSchema", () => {
  it("默认回落 gradient", () => {
    const parsed = BackgroundSchema.parse(undefined);
    expect(parsed.type).toBe("gradient");
    expect(parsed.media).toBeUndefined();
  });

  it("解析完整 media 配置", () => {
    const parsed = BackgroundSchema.parse({
      type: "video",
      media: {
        src: "bg/clip.mp4",
        opacity: 0.8,
        blur: 4,
        scale: "cover",
        position: "center",
        videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 },
      },
    });
    expect(parsed.type).toBe("video");
    expect(parsed.media?.scale).toBe("cover");
    expect(parsed.media?.videoOptions?.loop).toBe(true);
  });

  it("media 各字段有默认值", () => {
    const parsed = BackgroundSchema.parse({ type: "image", media: { src: "bg/x.png" } });
    expect(parsed.media?.opacity).toBe(1);
    expect(parsed.media?.blur).toBe(0);
    expect(parsed.media?.scale).toBe("cover");
    expect(parsed.media?.position).toBe("center");
  });
});

describe("RadarVideoSchema background 兼容", () => {
  it("旧配置（无 background）解析后回落 gradient", () => {
    const legacy = makeRadarProps(); // 不含 background 字段的合法 props
    // @ts-expect-error 故意删除以模拟旧数据
    delete legacy.background;
    const parsed = RadarVideoSchema.parse(legacy);
    expect(parsed.background.type).toBe("gradient");
  });
});
```

> 注：`makeRadarProps` 若 `_fixtures.ts` 未导出合适工厂，则改用现有 fixture（见 `tests/unit/frontend/components/editor/_fixtures.ts`）构造一份合法 props；保证它**不含** `background` 即可。

**Step 2: 跑测试确认失败**

Run: `cd frontend && pnpm exec vitest run ../tests/unit/frontend/types/radar.test.ts`
Expected: FAIL（`BackgroundSchema` / `defaultBackground` 未导出）

**Step 3: 最小实现**

在 `frontend/src/types/radar.ts` 中，`RadarVideoSchema` 定义**之前**新增：

```typescript
export const BackgroundMediaSchema = z.object({
  src: z.string().default(""),
  opacity: z.number().min(0).max(1).default(1),
  blur: z.number().min(0).max(50).default(0),
  scale: z.enum(["cover", "contain", "fill"]).default("cover"),
  position: z.enum(["center", "top", "bottom", "left", "right"]).default("center"),
  videoOptions: z
    .object({
      loop: z.boolean().default(true),
      muted: z.boolean().default(true),
      playbackRate: z.number().min(0.25).max(4).default(1),
      startFrom: z.number().min(0).default(0), // 毫秒；渲染时按 fps 换算为帧
    })
    .default({ loop: true, muted: true, playbackRate: 1, startFrom: 0 }),
});

export const BackgroundSchema = z
  .object({
    type: z.enum(["gradient", "image", "video"]).default("gradient"),
    media: BackgroundMediaSchema.optional(),
  })
  .default({ type: "gradient" });

export type BackgroundConfig = z.infer<typeof BackgroundSchema>;
export type BackgroundMediaConfig = z.infer<typeof BackgroundMediaSchema>;

export const defaultBackground: BackgroundConfig = { type: "gradient" };
```

在 `RadarVideoSchema` 的对象字面量内（紧跟 `theme:` 之后即可）新增一行：

```typescript
  background: BackgroundSchema,
```

**Step 4: 跑测试确认通过**

Run: `cd frontend && pnpm exec vitest run ../tests/unit/frontend/types/radar.test.ts`
Expected: PASS

**Step 5: 确认全量类型/单测不回归**

Run: `cd frontend && pnpm test:unit`
Expected: 既有用例全绿（注意：若有 fixture/默认 props 工厂未带 `background`，因 `.default()` 解析不报错；但若某些直接构造 `RadarVideoProps` 字面量的 .tsx 出现 TS 报错，需在对应 fixture 补 `background: defaultBackground`）。

**Step 6: Commit**

```bash
git add frontend/src/types/radar.ts tests/unit/frontend/types/radar.test.ts
git commit -s -m "feat(types): 新增 BackgroundSchema 三态背景配置（向后兼容回落 gradient）"
```

### Task 1.2：补齐默认配置与 fixture

**Files:**
- Modify: 默认 props 工厂所在文件（搜索 `silhouetteSrc:` 定位默认 `RadarVideoProps` 字面量；常见于 `frontend/src/lib/` 或 `frontend/src/types/constants.ts`）
- Modify: `tests/unit/frontend/components/editor/_fixtures.ts`、`frontend/src/test/fixtures.ts`
- Test: 复用 1.1

**Step 1: 定位所有硬编码 `RadarVideoProps` 默认值**

Run: `cd frontend && grep -rln "vignetteEnabled" src tests` （这些点同样需要 `background`）
对每个构造完整 `RadarVideoProps` 字面量的位置，新增 `background: defaultBackground`（import from `@/types/radar`）。

**Step 2–4: 跑类型检查 + 单测**

Run: `cd frontend && pnpm test:unit`
Expected: 全绿。若 TS 报缺 `background`，按 Step 1 补齐。

**Step 5: Commit**

```bash
git add -A
git commit -s -m "chore(types): 默认 props 与 fixture 补齐 background 字段"
```

---

## 阶段 2 — 渲染组件（纯视觉，无声）

### Task 2.1：独立 `Vignette` 叠加组件

> 决策 Q3：gradient 模式的 `BackgroundGradient` **原样不动**；本组件仅供 image/video 背景叠加，参数复用 vignette 字段，近似实现（加性变暗无法用 alpha 等价，故为新路径独立近似）。

**Files:**
- Create: `frontend/src/remotion/Effects/Vignette.tsx`
- Test: `tests/unit/frontend/remotion/Effects/Vignette.test.tsx`

**Step 1: 写失败测试**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Vignette } from "@/remotion/Effects/Vignette";
import type { RadarTheme } from "@/types/radar";

const theme = (over: Partial<RadarTheme> = {}): RadarTheme => ({
  backgroundColor: "#0b1020", gridColor: "#1e293b", gridFillColor: "#334155",
  gridStrokeColor: "#475569", dotColor: "#38bdf8", highValueDotColor: "#f59e0b",
  labelColor: "#e2e8f0", valueColor: "#facc15", glowColor: "#38bdf8",
  enhanceArrowColor: "#ef4444", weakenArrowColor: "#22c55e", silhouetteOpacity: 0.8,
  vignetteEnabled: true, vignetteBrightness: -60, vignetteCenterX: 50,
  vignetteCenterY: 50, vignetteInnerStop: 30, vignetteOuterStop: 90, ...over,
});

describe("Vignette", () => {
  it("vignetteEnabled=false 时不渲染遮罩", () => {
    const { container } = render(<Vignette theme={theme({ vignetteEnabled: false })} />);
    expect(container.firstChild).toBeNull();
  });

  it("启用时渲染一个 radial-gradient 叠加层", () => {
    const { container } = render(<Vignette theme={theme()} />);
    const el = container.firstChild as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.background).toContain("radial-gradient");
    expect(el.style.background).toContain("50% 50%");
  });
});
```

**Step 2:** Run: `cd frontend && pnpm exec vitest run ../tests/unit/frontend/remotion/Effects/Vignette.test.tsx` → FAIL（组件不存在）

**Step 3: 实现**

```tsx
import React from "react";
import { AbsoluteFill } from "remotion";
import type { RadarTheme } from "../../types/radar";

type VignetteProps = { theme: RadarTheme };

/**
 * 媒体背景专用的 vignette 叠加层。
 *
 * Why 独立而非复用 BackgroundGradient：现有 vignette 把 backgroundColor 加性变暗
 * 烘进单个 radial-gradient，无法用 alpha 叠加像素级等价复现（见设计决策 Q3）。
 * 媒体背景是全新路径，此处用「中心透明→边缘半透明黑」的叠加渐变做视觉近似，
 * 暗度由 vignetteBrightness（-100~0）映射为边缘 alpha。
 */
export const Vignette: React.FC<VignetteProps> = ({ theme }) => {
  if (!theme.vignetteEnabled) return null;
  const {
    vignetteBrightness, vignetteCenterX, vignetteCenterY,
    vignetteInnerStop, vignetteOuterStop,
  } = theme;
  // brightness -100..0 → 边缘黑色 alpha 0..1
  const edgeAlpha = Math.min(1, Math.max(0, -vignetteBrightness / 100));
  const background =
    `radial-gradient(circle at ${vignetteCenterX}% ${vignetteCenterY}%, ` +
    `rgba(0,0,0,0) ${vignetteInnerStop}%, ` +
    `rgba(0,0,0,${edgeAlpha}) ${vignetteOuterStop}%)`;
  return <AbsoluteFill style={{ background, pointerEvents: "none" }} />;
};
```

**Step 4:** Run 同 Step 2 → PASS

**Step 5: Commit**

```bash
git add frontend/src/remotion/Effects/Vignette.tsx tests/unit/frontend/remotion/Effects/Vignette.test.tsx
git commit -s -m "feat(remotion): 新增媒体背景专用 Vignette 叠加组件"
```

### Task 2.2：`BackgroundMedia` 组件（图片 + 视频，无声）

**Files:**
- Create: `frontend/src/remotion/Effects/BackgroundMedia.tsx`
- Test: `tests/unit/frontend/remotion/Effects/BackgroundMedia.test.tsx`
- 复用：`isRemoteSilhouetteSrc`（`frontend/src/remotion/CharacterSilhouette/Silhouette.tsx` 已导出）用于 src 解析

**Step 1: 写失败测试**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { BackgroundMedia } from "@/remotion/Effects/BackgroundMedia";
import type { BackgroundMediaConfig } from "@/types/radar";

// Remotion 的 Img/OffthreadVideo 在 jsdom 下需 mock 为简单标签
vi.mock("remotion", async (orig) => {
  const actual = await orig<typeof import("remotion")>();
  return {
    ...actual,
    Img: (p: Record<string, unknown>) => <img data-testid="bg-img" {...p} />,
    OffthreadVideo: (p: Record<string, unknown>) => <video data-testid="bg-video" {...p} />,
    staticFile: (s: string) => `/static/${s}`,
    useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 300 }),
  };
});

const media = (over: Partial<BackgroundMediaConfig> = {}): BackgroundMediaConfig => ({
  src: "bg/x.png", opacity: 0.5, blur: 4, scale: "contain", position: "top",
  videoOptions: { loop: true, muted: true, playbackRate: 1, startFrom: 0 }, ...over,
});

describe("BackgroundMedia", () => {
  it("type=image 渲染 Img，应用 objectFit/position/opacity/blur", () => {
    const { getByTestId } = render(<BackgroundMedia type="image" media={media()} />);
    const img = getByTestId("bg-img") as HTMLImageElement;
    expect(img.style.objectFit).toBe("contain");
    expect(img.style.objectPosition).toBe("top");
    expect(img.style.opacity).toBe("0.5");
    expect(img.style.filter).toContain("blur(4px)");
  });

  it("type=video 渲染 OffthreadVideo，传 loop/muted/playbackRate", () => {
    const { getByTestId } = render(<BackgroundMedia type="video" media={media({ src: "bg/c.mp4" })} />);
    expect(getByTestId("bg-video")).not.toBeNull();
  });

  it("空 src 不渲染", () => {
    const { container } = render(<BackgroundMedia type="image" media={media({ src: "" })} />);
    expect(container.firstChild).toBeNull();
  });

  it("scale=fill 映射 objectFit:fill", () => {
    const { getByTestId } = render(<BackgroundMedia type="image" media={media({ scale: "fill" })} />);
    expect((getByTestId("bg-img") as HTMLImageElement).style.objectFit).toBe("fill");
  });
});
```

**Step 2:** Run: `cd frontend && pnpm exec vitest run ../tests/unit/frontend/remotion/Effects/BackgroundMedia.test.tsx` → FAIL

**Step 3: 实现**

```tsx
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useVideoConfig } from "remotion";
import type { BackgroundMediaConfig } from "../../types/radar";
import { isRemoteSilhouetteSrc } from "../CharacterSilhouette/Silhouette";

type BackgroundMediaProps = {
  type: "image" | "video";
  media: BackgroundMediaConfig;
};

const SCALE_TO_FIT: Record<BackgroundMediaConfig["scale"], React.CSSProperties["objectFit"]> = {
  cover: "cover", contain: "contain", fill: "fill",
};

/** 解析媒体 src：远程/blob/data 原样，相对路径走 staticFile（与剪影同规则）。 */
function resolveSrc(src: string): string {
  return isRemoteSilhouetteSrc(src) ? src : staticFile(src);
}

export const BackgroundMedia: React.FC<BackgroundMediaProps> = ({ type, media }) => {
  const { fps } = useVideoConfig();
  if (!media.src) return null;

  const commonStyle: React.CSSProperties = {
    width: "100%", height: "100%",
    objectFit: SCALE_TO_FIT[media.scale],
    objectPosition: media.position,
    opacity: media.opacity,
    filter: media.blur > 0 ? `blur(${media.blur}px)` : undefined,
  };
  const src = resolveSrc(media.src);

  return (
    <AbsoluteFill>
      {type === "video" ? (
        <OffthreadVideo
          src={src}
          // OffthreadVideo 无音轨；声音由 musicUrl/独立 Audio 负责（阶段 7）。
          muted
          loop={media.videoOptions.loop}
          playbackRate={media.videoOptions.playbackRate}
          // startFrom 毫秒 → 帧
          trimBefore={Math.round((media.videoOptions.startFrom / 1000) * fps)}
          style={commonStyle}
        />
      ) : (
        <Img src={src} style={commonStyle} />
      )}
    </AbsoluteFill>
  );
};
```

> 注：若 Remotion 4.0.481 该版本 `OffthreadVideo` 不支持 `trimBefore`，改用 `startFrom`（帧）属性名；以 `pnpm exec tsc --noEmit` 报错为准微调。`loop` 在 OffthreadVideo 渲染端支持。

**Step 4:** Run 同 Step 2 → PASS

**Step 5: Commit**

```bash
git add frontend/src/remotion/Effects/BackgroundMedia.tsx tests/unit/frontend/remotion/Effects/BackgroundMedia.test.tsx
git commit -s -m "feat(remotion): 新增 BackgroundMedia 组件（图片/视频背景，纯视觉无声）"
```

### Task 2.3：`RadarVideo` 背景层按 type 分发

**Files:**
- Modify: `frontend/src/remotion/RadarVideo.tsx`（背景 `<Sequence>`，约 line 333-335）
- Test: `tests/unit/frontend/remotion/RadarVideo.test.tsx`（新建或补充）

**Step 1: 写失败测试**（聚焦分发逻辑，mock 子组件）

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/remotion/Effects/BackgroundGradient", () => ({
  BackgroundGradient: () => <div data-testid="bg-gradient" />,
}));
vi.mock("@/remotion/Effects/BackgroundMedia", () => ({
  BackgroundMedia: ({ type }: { type: string }) => <div data-testid="bg-media" data-type={type} />,
}));
vi.mock("@/remotion/Effects/Vignette", () => ({ Vignette: () => <div data-testid="vignette" /> }));
// 其余重组件（RadarChart/Silhouette/HighValueGlow）按需 mock，fonts/useVideoConfig 同 BackgroundMedia 测试
// ... 构造最小 props（含 background）

describe("RadarVideo 背景分发", () => {
  it("type=gradient 渲染 BackgroundGradient，不渲染 BackgroundMedia", () => { /* ... */ });
  it("type=image 渲染 BackgroundMedia(type=image) + Vignette，不渲染 BackgroundGradient", () => { /* ... */ });
  it("type=video 渲染 BackgroundMedia(type=video)", () => { /* ... */ });
});
```

> 测试构造 props 较重，参考 `Silhouette.test.tsx` 的 mock 套路；若过重则降级为对一个纯函数 `selectBackground(background)` 的单测（见 Step 3 备选）。

**Step 2:** Run → FAIL

**Step 3: 实现**

把 `RadarVideo.tsx` 当前：

```tsx
      <Sequence>
        <BackgroundGradient theme={theme} />
      </Sequence>
```

替换为按 `props.background.type` 分发（在组件顶部解构出 `background`）：

```tsx
      <Sequence>
        {background.type === "gradient" || !background.media?.src ? (
          <BackgroundGradient theme={theme} />
        ) : (
          <>
            <BackgroundMedia type={background.type} media={background.media} />
            <Vignette theme={theme} />
          </>
        )}
      </Sequence>
```

import 新组件；在 `const { ... } = props;` 加 `background`。

> 备选（若 GUI 测试过重）：抽 `frontend/src/remotion/Effects/selectBackground.ts` 纯函数返回 `"gradient" | "media"`，对其单测，组件内调用。优先内联分发 + GUI 测试。

**Step 4:** Run → PASS

**Step 5: 跑 remotion 相关单测 + 类型**

Run: `cd frontend && pnpm exec tsc --noEmit && pnpm test:unit`
Expected: 全绿

**Step 6: Commit**

```bash
git add frontend/src/remotion/RadarVideo.tsx tests/unit/frontend/remotion/RadarVideo.test.tsx
git commit -s -m "feat(remotion): RadarVideo 背景层按 background.type 分发（gradient/媒体+vignette）"
```

### Task 2.4：本地公共素材手动验证（无测试）

**Step 1:** 放一张测试图到 `frontend/public/bg/test.png`、一段短 mp4 到 `frontend/public/bg/test.mp4`。
**Step 2:** 启动 Remotion Studio 或 Player 预览，手动把某页 `background` 改成 `{type:"image", media:{src:"bg/test.png",...}}` 验证渲染。
**Step 3:** 记录结果，不 commit 测试资源（除非确实需要 fixture，按 §2.5 放 `tests/data/`）。

---

## 阶段 3 — 渲染端鉴权（泛化改写，复用现有 copy）

> 目标：让**上传的**背景媒体能服务端渲染。先泛化 `silhouette_rewrite` 为按值匹配（覆盖背景媒体），保留现有 copy 机制 → 本地 + Docker 均正确。零拷贝优化留阶段 6。

### Task 3.1：`silhouette_rewrite` → 按值匹配泛化

**Files:**
- Modify: `backend/app/service/silhouette_rewrite.py`（`_walk_and_rewrite`、`_collect_tmp_tokens` 改为按**值**匹配，不再限定 key 名 `silhouetteSrc`）
- Test: `tests/unit/backend/service/test_silhouette_rewrite.py`（新增背景媒体用例）

**Step 1: 写失败测试**（在现有文件追加）

```python
class TestRewriteBackgroundMedia:
    def test_rewrites_background_media_src(self, file_service: FileService, public_dir: Path) -> None:
        props = {"background": {"type": "video", "media": {"src": UPLOADS_URL}}}
        rewritten, tmp_files = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
        )
        assert rewritten["background"]["media"]["src"].startswith("_render_tmp/")
        assert len(tmp_files) == 1

    def test_cleanup_removes_background_media_tmp(self, file_service: FileService, public_dir: Path) -> None:
        props = {"background": {"media": {"src": UPLOADS_URL}}}
        rewritten, _ = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
        )
        rel = rewritten["background"]["media"]["src"]
        tmp_dir = public_dir / rel.split("/")[0] / rel.split("/")[1]
        assert tmp_dir.is_dir()
        cleanup_render_tmp(rewritten, public_dir)
        assert not tmp_dir.exists()
```

**Step 2:** Run: `cd backend && uv run pytest ../tests/unit/backend/service/test_silhouette_rewrite.py -v` → FAIL（背景媒体 src 未被改写）

**Step 3: 实现**

`_walk_and_rewrite`：把「`if key == "silhouetteSrc" and isinstance(value, str)`」改为「对**任意字符串值**尝试改写」：

```python
def _walk_and_rewrite(obj, *, user_id, file_service, public_dir, token, tmp_files):
    if isinstance(obj, dict):
        for key, value in obj.items():
            if isinstance(value, str):
                new_val = _try_rewrite(value, user_id=user_id, file_service=file_service,
                                       public_dir=public_dir, token=token, tmp_files=tmp_files)
                if new_val is not None:
                    obj[key] = new_val
            else:
                _walk_and_rewrite(value, user_id=user_id, file_service=file_service,
                                  public_dir=public_dir, token=token, tmp_files=tmp_files)
    elif isinstance(obj, list):
        for item in obj:
            _walk_and_rewrite(item, ...)
```

`_collect_tmp_tokens`：同理改为「任意字符串值以 `_render_tmp/` 开头即收集 token」，不再限定 key 名。

> `_try_rewrite` 已是「不匹配 uploads 正则返回 None」，天然安全：非 uploads 字符串原样跳过。

**Step 4:** Run 同 Step 2 → PASS；并跑全量 `cd backend && uv run pytest ../tests/unit/backend/service/test_silhouette_rewrite.py ../tests/unit/backend/service/test_render_service.py -v` 确认剪影既有用例不回归。

**Step 5:（可选）更名**

如时间允许，把 `silhouette_rewrite.py` → `media_rewrite.py`、`rewrite_uploaded_silhouettes` → `rewrite_uploaded_media`、`cleanup_render_tmp` 保留名；同步改 `render_service.py:12,36` import 与测试文件名 `test_media_rewrite.py`。**若更名，须单独一个 commit**，避免与逻辑改动混淆。否则保留原名（功能已正确）。

**Step 6: Commit**

```bash
git add backend/app/service/silhouette_rewrite.py tests/unit/backend/service/test_silhouette_rewrite.py
git commit -s -m "feat(service): 渲染改写泛化为按值匹配，覆盖背景媒体上传 URL"
```

### Task 3.2：后端 dev-integration 回归

**Step 1:** Run: `cd backend && uv run pytest ../tests/unit/backend/ ../tests/dev-integration/backend/ -v`
Expected: 全绿 + 覆盖率达标（后端 ≥80% / 文件 ≥50%）。
**Step 2:** 不达标则补 `media` 分支测试。

---

## 阶段 4 — 预览 + 上传

### Task 4.1：`replaceUploads` 泛化识别背景媒体 src

**Files:**
- Modify: `frontend/src/components/editor/PreviewPanel.tsx`（`replaceUploads`，约 line 499-527）
- Test: `tests/unit/frontend/components/editor/PreviewPanel.test.tsx`（若不存在则新建，仅测 `replaceUploads` 纯逻辑——建议把它抽成可导出纯函数）

**Step 1: 抽纯函数 + 写失败测试**

把 `replaceUploads` 内的替换逻辑抽成可导出函数 `frontend/src/lib/replace-uploads.ts`：

```typescript
// 输入：任意 inputProps 树 + (name)=>cachedUrl|undefined 取缓存 + (name)=>void 触发加载
// 行为：把任意字符串值匹配 /api/v1/files/uploads/<name>$ 的，替换为缓存 objectURL（无缓存则触发加载并保留原值）
```

测试 `tests/unit/frontend/lib/replace-uploads.test.ts`：

```typescript
import { describe, it, expect, vi } from "vitest";
import { replaceUploadsInProps } from "@/lib/replace-uploads";

const URL = "http://x/api/v1/files/uploads/clip.mp4";

describe("replaceUploadsInProps", () => {
  it("替换 silhouetteSrc 与 background.media.src（任意 key）", () => {
    const cache: Record<string, string> = { "clip.mp4": "blob:abc", "hero.png": "blob:def" };
    const out = replaceUploadsInProps(
      { silhouetteSrc: "http://x/api/v1/files/uploads/hero.png",
        background: { media: { src: URL } } },
      (n) => cache[n], () => {},
    ) as any;
    expect(out.silhouetteSrc).toBe("blob:def");
    expect(out.background.media.src).toBe("blob:abc");
  });

  it("无缓存时保留原值并触发加载", () => {
    const trigger = vi.fn();
    const out = replaceUploadsInProps({ background: { media: { src: URL } } }, () => undefined, trigger) as any;
    expect(out.background.media.src).toBe(URL);
    expect(trigger).toHaveBeenCalledWith("clip.mp4");
  });
});
```

**Step 2:** Run → FAIL

**Step 3: 实现** `replace-uploads.ts`（把 PreviewPanel 内逻辑泛化为「任意字符串 key」），然后 `PreviewPanel.tsx` 改为调用它（`replaceUploads = (o) => replaceUploadsInProps(o, (n)=>uploadObjectUrlCache[n], getObjectUrl)`）。

**Step 4:** Run → PASS；`pnpm test:unit` 不回归。

**Step 5: Commit**

```bash
git add frontend/src/lib/replace-uploads.ts frontend/src/components/editor/PreviewPanel.tsx tests/unit/frontend/lib/replace-uploads.test.ts
git commit -s -m "feat(editor): 预览 uploads 替换泛化，支持背景媒体 blob 化"
```

### Task 4.2：`AssetSelector` 新增 `backgrounds` 类

**Files:**
- Modify: `frontend/src/components/files/AssetSelector.tsx`（`AssetCategory` 加 `"backgrounds"`；扩展名过滤含图片+视频；视频缩略图用 `<video muted preload="metadata">`）
- Modify: `frontend/src/hooks/usePublicAssets.ts`（若公共素材列表按类目，需支持 backgrounds 目录；否则 backgrounds 仅来自用户上传）
- Test: `tests/unit/frontend/components/files/AssetSelector.test.tsx`（补 backgrounds 用例）

**Step 1: 写失败测试** — backgrounds 类下：用户上传的 `.mp4`/`.png` 都进列表；视频项渲染 `<video>`、图片项渲染 `<img>`。

**Step 2:** Run → FAIL

**Step 3: 实现**
- `type AssetCategory = "silhouettes" | "music" | "backgrounds";`
- userAssets 过滤：backgrounds → `/\.(png|jpg|jpeg|gif|webp|svg|mp4|webm|mov)$/i`
- 缩略图：backgrounds 类里，文件名匹配视频扩展名 → `<video src={...} muted preload="metadata">`，否则 `<img>`
- accept：`backgrounds` → `"image/*,video/*"`
- 公共素材：若 `usePublicAssets` 无 backgrounds 源，则 `publicAssets = category==="backgrounds" ? [] : ...`（仅用户上传）

**Step 4:** Run → PASS

**Step 5: Commit**

```bash
git add frontend/src/components/files/AssetSelector.tsx frontend/src/hooks/usePublicAssets.ts tests/unit/frontend/components/files/AssetSelector.test.tsx
git commit -s -m "feat(files): AssetSelector 新增 backgrounds 类（图片+视频，视频显首帧）"
```

### Task 4.3：上传体积/分辨率软警告

> 决策 Q7：软警告不硬拦。单文件 ~50MB、超 1080p 提示。

**Files:**
- Create: `frontend/src/lib/media-guard.ts`（纯函数：`checkBackgroundVideo(file, {width,height,size}) => warnings[]`）
- Modify: `AssetSelector.tsx`（backgrounds 上传时读 `<video>` 元数据，调用 guard，提示但不阻止）
- Test: `tests/unit/frontend/lib/media-guard.test.ts`

**Step 1: 写失败测试**

```typescript
import { describe, it, expect } from "vitest";
import { checkBackgroundVideo, BG_VIDEO_SIZE_WARN_BYTES } from "@/lib/media-guard";

describe("checkBackgroundVideo", () => {
  it("超 50MB 给体积警告", () => {
    const w = checkBackgroundVideo({ width: 1920, height: 1080, sizeBytes: BG_VIDEO_SIZE_WARN_BYTES + 1 });
    expect(w.some((m) => m.includes("体积"))).toBe(true);
  });
  it("超 1080p 给分辨率警告", () => {
    const w = checkBackgroundVideo({ width: 3840, height: 2160, sizeBytes: 1000 });
    expect(w.some((m) => m.includes("分辨率"))).toBe(true);
  });
  it("正常视频无警告", () => {
    expect(checkBackgroundVideo({ width: 1280, height: 720, sizeBytes: 1000 })).toEqual([]);
  });
});
```

**Step 2–4:** 实现 `media-guard.ts`（`BG_VIDEO_SIZE_WARN_BYTES = 50*1024*1024`，分辨率 >1920×1080 触发），接入 AssetSelector 上传回调（toast/inline 提示），跑绿。

**Step 5: Commit**

```bash
git add frontend/src/lib/media-guard.ts frontend/src/components/files/AssetSelector.tsx tests/unit/frontend/lib/media-guard.test.ts
git commit -s -m "feat(files): 背景视频体积/分辨率上传软警告"
```

---

## 阶段 5 — 编辑器「背景」面板

### Task 5.1：新建 `BackgroundConfigPanel` + 挪入 vignette

**Files:**
- Create: `frontend/src/components/editor/BackgroundConfigPanel.tsx`
- Modify: `frontend/src/components/editor/ThemeEditor.tsx`（**移除** vignette 区块，仅保留配色）
- Modify: 装配处（搜索 `<ThemeEditor` 定位，常见 `PageConfigPanel.tsx` / `RadarEditor.tsx`），在其旁挂 `<BackgroundConfigPanel>`
- Test: `tests/unit/frontend/components/editor/BackgroundConfigPanel.test.tsx`；更新 `ThemeEditor.test.tsx`（移除 vignette 断言）

**Step 1: 写失败测试**（BackgroundConfigPanel）

覆盖：类型三选一切换触发 `onChange({background:{type}})`；type=image/video 时显示 `AssetSelector(category=backgrounds)` 与 opacity/blur/scale/position 控件；type=video 时额外显示 loop/muted/playbackRate/startFrom；vignette 开关与滑块在本面板内（从 theme 读写）。

**Step 2:** Run → FAIL

**Step 3: 实现**
- props：`background: BackgroundConfig`、`theme: RadarTheme`（用于 vignette）、`onChange(updates: Partial<RadarVideoProps>)`。
- 类型切换按钮组（参考 CharacterConfig 的 align 按钮组样式）。
- media 控件：复用 `Slider`/`Label`/`Switch` + `AssetSelector`（`category="backgrounds"`，`value=background.media?.src`，`onChange` 写 `background.media.src`）。
- scale/position：按钮组或 `<select>`（参考现有控件）。
- vignette：把 `ThemeEditor` 原 vignette 区块整段搬来，读写 `theme.vignette*`（通过 `onChange({theme:{...}})`）。
- 更新 media 字段时注意：首次从无 media 切到 image/video 要用 `defaultBackground` 的 media 默认值初始化（用 `BackgroundMediaSchema.parse({src:""})` 得默认）。

**Step 4:** Run → PASS

**Step 5: 更新 ThemeEditor**：删除 vignette 区块与相关测试断言；`ThemeEditor.test.tsx` 改为只断言配色字段。Run `pnpm test:unit` 全绿。

**Step 6: 装配 + 手动验证**：把面板挂进页面，`pnpm dev` 手动验证三态切换、滑块联动预览。

**Step 7: Commit**

```bash
git add frontend/src/components/editor/BackgroundConfigPanel.tsx frontend/src/components/editor/ThemeEditor.tsx frontend/src/components/editor/PageConfigPanel.tsx tests/unit/frontend/components/editor/BackgroundConfigPanel.test.tsx tests/unit/frontend/components/editor/ThemeEditor.test.tsx
git commit -s -m "feat(editor): 新增背景配置面板（三态 + media 控件），vignette 迁入"
```

### Task 5.2：阶段 1–5 全量回归 + e2e（复杂任务完成触发）

**Step 1:** 前端：`cd frontend && pnpm test:unit && pnpm test:integration`（全绿 + 前端覆盖率 ≥60%/文件 ≥50%）
**Step 2:** 后端：`cd backend && uv run pytest ../tests/unit/backend/ ../tests/dev-integration/backend/ -v`
**Step 3:**（本地许可时，复杂任务完成自动跑一次）前端 e2e：`cd frontend && pnpm exec playwright test tests/testenv-integration/frontend/`；后端 API e2e：`cd backend && uv run pytest ../tests/testenv-integration/backend/ -v`。e2e 配置由测试系统注入（见 CLAUDE.md §3.3）。
**Step 4:** Docker 本地构建验证（CI 不建镜像）：`docker compose -f deploy/docker-compose.yml build` + 起栈跑一次图片背景渲染冒烟。

---

## 阶段 6 — 渲染端零拷贝优化（方案 B 挂载 + copy 回退）

> 设计决策方案 B：把 `backend_storage` 只读挂进 worker publicDir，背景视频零拷贝。**已验证**（见决策文档验证记录）。本地开发无挂载 → 保留 copy 回退。

### Task 6.1：rewrite 支持「挂载命中则改写挂载路径，否则 copy」

**Files:**
- Modify: `backend/app/service/silhouette_rewrite.py`（`_try_rewrite`：若 `public_dir / _MOUNT_SUBDIR` 存在，则改写为 `_user_media/users/<uid>/uploads/<name>`，**不 copy、不入 tmp_files**；否则走现有 copy）
- Modify: `backend/app/core/config.py`（可选：`media_mount_subdir: str = "_user_media"`）
- Test: `tests/unit/backend/service/test_silhouette_rewrite.py`

**Step 1: 写失败测试**

```python
class TestMountZeroCopy:
    def test_uses_mount_path_when_mount_present(self, file_service, public_dir):
        (public_dir / "_user_media").mkdir()  # 模拟挂载存在
        props = {"background": {"media": {"src": UPLOADS_URL.replace("hero.png", "clip.mp4")}}}
        # 需先在 file_service 放 clip.mp4
        file_service.save_upload(user_id=1, filename="clip.mp4", data=b"\x00\x00\x00\x18ftyp")
        rewritten, tmp_files = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir)
        src = rewritten["background"]["media"]["src"]
        assert src == "_user_media/users/1/uploads/clip.mp4"
        assert tmp_files == []  # 零拷贝，无临时文件

    def test_falls_back_to_copy_without_mount(self, file_service, public_dir):
        props = {"silhouetteSrc": UPLOADS_URL}
        rewritten, tmp_files = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir)
        assert rewritten["silhouetteSrc"].startswith("_render_tmp/")
        assert len(tmp_files) == 1
```

**Step 2:** Run → FAIL

**Step 3: 实现** `_try_rewrite`：

```python
_MOUNT_SUBDIR = "_user_media"

def _try_rewrite(url, *, user_id, file_service, public_dir, token, tmp_files):
    m = _UPLOADS_URL_RE.search(url)
    if not m:
        return None
    name = unquote(m.group(1))
    # 校验文件存在 + 防穿越（即便走挂载也要校验）
    file_service.get_upload_path(user_id, name)
    mount_dir = public_dir / _MOUNT_SUBDIR
    if mount_dir.is_dir():
        # 方案 B：挂载命中，零拷贝改写为挂载相对路径（与 storage 布局一致）
        return f"{_MOUNT_SUBDIR}/users/{user_id}/uploads/{name}"
    # 回退：copy 进 _render_tmp（本地开发无挂载）
    src_path = file_service.get_upload_path(user_id, name)
    rel = f"{_TMP_PREFIX}/{token}/{name}"
    dest = public_dir / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_path, dest)
    tmp_files.append(dest)
    return rel
```

**Step 4:** Run → PASS（全量 rewrite 测试不回归）

**Step 5: Commit**

```bash
git add backend/app/service/silhouette_rewrite.py backend/app/core/config.py tests/unit/backend/service/test_silhouette_rewrite.py
git commit -s -m "feat(service): 背景媒体渲染零拷贝（挂载命中改写路径，本地回退 copy）"
```

### Task 6.2：compose 加只读挂载（构建链路变更，须审计）

> **§13 审计**：本任务改 compose 挂载，属构建/部署链路变更。动手前列出受影响位点。

**Files:**
- Modify: `deploy/docker-compose.yml`（render-worker `volumes:` 新增 `backend_storage:/app/public/_user_media:ro`）

**审计表（写入 PR/commit 说明）：**

| 文件:行 | 改动 | 依赖 context? | 处置 |
| - | - | - | - |
| deploy/docker-compose.yml render-worker volumes | 新增 `backend_storage:/app/public/_user_media:ro` | N/A（卷挂载非 COPY） | 新增只读挂载 |

**Step 1:** 在 render-worker service 的 `volumes:` 下新增：

```yaml
      - backend_storage:/app/public/_user_media:ro
```

**Step 2:** 本地构建 + 起栈验证（CI 不建镜像）：

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

冒烟：上传一个背景视频 → 提交渲染 → 确认 worker 经 `_user_media/...` 读到原件、产物含视频背景、`_render_tmp` 无新增 copy。

**Step 3:** 检查 worker 容器内 `/app/public/_user_media/users/<uid>/uploads/` 可读、只读（写应失败）。

**Step 4: Commit**

```bash
git add deploy/docker-compose.yml
git commit -s -m "feat(deploy): render-worker 只读挂载 backend_storage 到 publicDir，背景媒体零拷贝"
```

---

## 阶段 7 — 背景视频音频（独立子阶段，spike 闸门）

> 决策 Q9：首期支持背景视频出声。⚠️ 本阶段是最大工作面，**先 spike 再实现**。`OffthreadVideo` 无音轨，需并行 `<Audio>`；服务端渲染 Remotion 自动混轨（省力），客户端 #41 WebCodecs 导出需多 AudioBuffer 混音（重）。

### Task 7.0：spike — 客户端多 AudioBuffer 混音可行性

**目标：** 验证在 `render-media-source.ts` 现有 AudioContext 解码基础上，能否把「musicUrl AudioBuffer + 背景视频音轨 AudioBuffer（按页时间偏移）」混成单 buffer 喂给 #41 的 AAC 编码。

**动作：** 读 `frontend/src/hooks/useLocalRender.tsx` + #41 引入的 WebCodecs 导出代码，确认音频注入点；写一个一次性脚本/笔记验证 `OfflineAudioContext` 混多源 + 偏移。结论写入决策文档。
**闸门：** 可行 → 继续 7.1+；不可行/成本过高 → 退回「服务端渲染支持出声、客户端导出背景视频静音」并记录。

### Task 7.1：composition 为背景视频加并行 `<Audio>`（服务端渲染出声）

**Files:**
- Modify: `frontend/src/remotion/RadarVideo.tsx`（背景为 video 且 `!muted` 时，加 `<Audio src volume>`，注意 `staticFile` 解析与 `startFrom`→帧、`playbackRate`）
- Test: `tests/unit/frontend/remotion/RadarVideo.test.tsx`（断言 video+unmuted 渲染 Audio）

TDD 五步同前。Commit：`feat(remotion): 背景视频音轨经并行 Audio 注入（服务端渲染出声）`

### Task 7.2：客户端导出混入背景视频音轨（依赖 7.0 结论）

**Files:**
- Modify: `frontend/src/lib/render-media-source.ts`（多源解码 + `OfflineAudioContext` 混音 + 按页偏移）
- Modify: `frontend/src/hooks/useLocalRender.tsx`（收集各页背景视频音源 + 偏移传入）
- Test: `tests/unit/frontend/lib/render-media-source.test.ts`

TDD 五步。Commit：`feat(local-render): 客户端导出混入背景视频音轨`

### Task 7.3：BackgroundConfigPanel 暴露 muted/音量；全量回归

放开 `videoOptions.muted` 开关（默认 true）；e2e 冒烟出声路径。

---

## 收尾

### 最终验收
- `cd frontend && pnpm test:unit && pnpm test:integration`（覆盖率前端 ≥60%/文件 ≥50%）
- `cd backend && uv run pytest ../tests/unit/backend/ ../tests/dev-integration/backend/ -v`（后端 ≥80%/文件 ≥50%）
- testenv e2e（本地许可）：前端 Playwright + 后端 API e2e
- Docker 本地构建 + 图片/视频背景渲染冒烟
- 更新 issue #18 任务勾选；PR 用 `Closes #18`

### 依赖说明
- 前端：**无新增 npm 依赖**（Remotion 内置 `Img`/`OffthreadVideo`/`Audio`）。如确需新增，按 CLAUDE.md §5 改 `package.json` + `pnpm install` 提交 `pnpm-lock.yaml`。
- 后端：无新增依赖。

### 风险与回归点
- **vignette 迁移**：gradient 模式 `BackgroundGradient` 不动，零回归；媒体 vignette 为近似新路径。
- **旧配置兼容**：`BackgroundSchema.default` 保证无 `background` 的存量 JSON 回落 gradient——务必在 Task 1 的兼容测试守住。
- **构建链路**（阶段 6 compose 挂载）：按 §13 审计，本地构建验证兜底。
- **音频阶段**（阶段 7）：spike 未过则降级为「客户端导出背景视频静音」。
