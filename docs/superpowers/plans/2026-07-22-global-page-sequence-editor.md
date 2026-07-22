# Global Page Sequence Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将“全局配置”的页面列表重构为可访问的单列拖拽编排台，使对比页作为不可拆分原子组移动，并同步收敛背景音乐、时长摘要和全局预览布局。

**Architecture:** 新增纯函数 `page-sequence.ts`，把索引型 `pages + comparisons` 映射为普通页/对比组序列，并集中处理重排、复制、删除和当前页索引映射。新增 `PageSequenceEditor` 使用 dnd-kit 经典 sortable API；`RadarEditor` 继续拥有配置状态，`GlobalConfigEditor` 只组合页面编排、音乐、时长和预览 subsection。

**Tech Stack:** React 19、TypeScript 6、Next.js 16、Tailwind CSS 4、Vitest 4、Testing Library、`@dnd-kit/core`、`@dnd-kit/sortable`、`@dnd-kit/utilities`、Playwright 1.61。

## Global Constraints

- 前端依赖只允许修改 `frontend/package.json`，锁文件只通过 `pnpm install` 生成；不得使用 npm/yarn。
- 所有生产代码必须先有失败测试，再写最小实现；每个 TDD 红灯必须因缺少目标行为而失败。
- 单元测试路径必须镜像 `frontend/src/`，源码根 `src/` 折叠：`frontend/src/lib/page-sequence.ts` 对应 `tests/unit/frontend/lib/page-sequence.test.ts`。
- 前端 unit 与 dev-integration 都禁止进程外 I/O；Playwright 仅位于 `tests/testenv-integration/frontend/`。
- 对比组是不可拆分原子项；组内顺序不可通过拖拽交换；其他页面不能落入组内。
- 删除绑定成员必须确认，且只删除目标页、解除关系、保留另一页。
- 复制绑定成员只复制目标页，未绑定副本插入整个组之后。
- 不改变 `MultiPageConfig` 持久化 schema，不新增持久化页面 ID。
- 页面操作按钮固定在 bar 右侧；背景音乐使用紧凑披露行；逐页时长明细默认折叠。
- 每个提交使用中文 Conventional Commit、`git commit -s`，并保留 `Co-Authored-By: Codex Opus 4.7 <noreply@anthropic.com>`。

---

## File Map

- Create `frontend/src/lib/page-sequence.ts`: 页面序列建模、重排、复制/删除和索引映射纯函数。
- Create `frontend/src/components/editor/PageSequenceEditor.tsx`: sortable bar、对比组、DragOverlay、右侧操作、删除确认与无障碍播报。
- Modify `frontend/src/components/editor/RadarEditor.tsx`: 用序列纯函数提交原子状态更新，替换单页上/下移动回调。
- Modify `frontend/src/components/editor/GlobalConfigEditor.tsx`: 组合 `PageSequenceEditor`，实现方案 A 的音乐披露、时长摘要/明细和预览布局。
- Modify `frontend/src/components/files/AssetSelector.tsx`: 增加 `embedded` 变体，嵌入音乐披露区时保留刷新/上传但不重复标题。
- Modify `frontend/package.json` and `frontend/pnpm-lock.yaml`: 声明并锁定三个 dnd-kit 包。
- Create `tests/unit/frontend/lib/page-sequence.test.ts`: 纯函数行为与边界测试。
- Create `tests/unit/frontend/components/editor/PageSequenceEditor.test.tsx`: 页面 bar、绑定组、操作、确认与拖拽回调测试。
- Modify `tests/unit/frontend/components/editor/RadarEditor.test.tsx`: 状态链路的重排、复制、删除和当前页索引测试。
- Modify `tests/unit/frontend/components/editor/GlobalConfigEditor.test.tsx`: 新布局、音乐披露、时长折叠和 PageSequenceEditor 接线测试。
- Modify `tests/unit/frontend/components/files/AssetSelector.test.tsx`: `embedded` 变体回归测试。
- Create `tests/dev-integration/frontend/components/editor/GlobalConfigEditor.test.tsx`: 真实容器状态下排序后时长/预览输入一致性测试。
- Create `tests/testenv-integration/frontend/page-sequence-reorder.spec.ts`: 鼠标与键盘重排的真实用户旅程；仅在测试系统提供 baseURL/后端/库时运行。

---

### Task 1: 页面序列纯函数与 dnd-kit 依赖

**Files:**
- Create: `frontend/src/lib/page-sequence.ts`
- Create: `tests/unit/frontend/lib/page-sequence.test.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/pnpm-lock.yaml`

**Interfaces:**
- Produces `PageSequenceItem`, `buildPageSequence`, `reorderPageSequence`, `duplicatePageInSequence`, `removePageFromSequence`。
- Later tasks consume sortable item IDs and the atomic result `{ pages, comparisons, activePageIndex }`。

- [ ] **Step 1: 声明并锁定 dnd-kit 依赖**

Run:

```powershell
cd frontend
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: `package.json` 新增三项依赖，`pnpm-lock.yaml` 由 pnpm 更新且安装成功。

- [ ] **Step 2: 写序列建模与重排失败测试**

在 `tests/unit/frontend/lib/page-sequence.test.ts` 写出以下核心断言：

```ts
it("把相邻对比页建模为一个原子序列项", () => {
  const config = makeConfig(["A", "B", "C", "D"], [[1, 2]]);
  expect(buildPageSequence(config)).toEqual([
    { id: "page:0", type: "page", pageIndices: [0] },
    { id: "comparison:1:2", type: "comparison", pageIndices: [1, 2] },
    { id: "page:3", type: "page", pageIndices: [3] },
  ]);
});

it("移动对比组时保持组内顺序并同步索引", () => {
  const config = makeConfig(["A", "B", "C", "D"], [[1, 2]]);
  const result = reorderPageSequence(config, 2, "comparison:1:2", "page:0");
  expect(result.pages.map((page) => page.characterName)).toEqual(["B", "C", "A", "D"]);
  expect(result.comparisons[0]).toMatchObject({ firstPageIndex: 0, secondPageIndex: 1 });
  expect(result.activePageIndex).toBe(1);
});

it("活动项或落点无效时返回原数据", () => {
  const config = makeConfig(["A", "B"], []);
  const result = reorderPageSequence(config, 0, "missing", "page:1");
  expect(result.pages).toBe(config.pages);
  expect(result.comparisons).toBe(config.comparisons);
  expect(result.activePageIndex).toBe(0);
});
```

- [ ] **Step 3: 运行目标测试并确认红灯**

Run:

```powershell
cd frontend
pnpm exec vitest run ../tests/unit/frontend/lib/page-sequence.test.ts
```

Expected: FAIL，原因是 `@/lib/page-sequence` 或目标导出不存在。

- [ ] **Step 4: 写最小序列建模与重排实现**

在 `frontend/src/lib/page-sequence.ts` 定义：

```ts
export type PageSequenceItem =
  | { id: `page:${number}`; type: "page"; pageIndices: [number] }
  | {
      id: `comparison:${number}:${number}`;
      type: "comparison";
      pageIndices: [number, number];
    };

export type PageSequenceResult = Pick<
  MultiPageConfig,
  "pages" | "comparisons"
> & { activePageIndex: number };

export function buildPageSequence(
  config: Pick<MultiPageConfig, "pages" | "comparisons">,
): PageSequenceItem[];

export function reorderPageSequence(
  config: Pick<MultiPageConfig, "pages" | "comparisons">,
  activePageIndex: number,
  activeId: string,
  overId: string,
): PageSequenceResult;
```

实现时先按 `firstPageIndex` 建 map，只有 `secondPageIndex === firstPageIndex + 1` 才聚合；把序列项移动后 flatten 原索引，生成 `oldIndex -> newIndex` map，再一次性重建 pages、comparisons 和 activePageIndex。对比项按新 `firstPageIndex` 排序。

- [ ] **Step 5: 运行序列测试并确认绿灯**

Run 同 Step 3。

Expected: PASS。

- [ ] **Step 6: 写复制与删除失败测试**

```ts
it("复制绑定成员时把未绑定副本放到整个组后", () => {
  const config = makeConfig(["A", "B", "C", "D"], [[1, 2]]);
  const result = duplicatePageInSequence(config, 1);
  expect(result.pages.map((page) => page.characterName)).toEqual([
    "A", "B", "C", "B (副本)", "D",
  ]);
  expect(result.comparisons[0]).toMatchObject({ firstPageIndex: 1, secondPageIndex: 2 });
  expect(result.insertedPageIndex).toBe(3);
});

it("删除绑定成员时解除对比并保留另一页", () => {
  const config = makeConfig(["A", "B", "C"], [[1, 2]]);
  const result = removePageFromSequence(config, 2, 2);
  expect(result.pages.map((page) => page.characterName)).toEqual(["A", "B"]);
  expect(result.comparisons).toEqual([]);
  expect(result.activePageIndex).toBe(1);
});
```

- [ ] **Step 7: 确认红灯后实现复制与删除**

新增签名：

```ts
export function duplicatePageInSequence(
  config: Pick<MultiPageConfig, "pages" | "comparisons">,
  pageIndex: number,
): Pick<MultiPageConfig, "pages" | "comparisons"> & { insertedPageIndex: number };

export function removePageFromSequence(
  config: Pick<MultiPageConfig, "pages" | "comparisons">,
  activePageIndex: number,
  pageIndex: number,
): PageSequenceResult;
```

复制使用 JSON 深拷贝现有 plain-data 页面并追加 ` (副本)`；若目标属于对比组，插入点为组尾之后。删除先丢弃所有引用目标页的 comparison，再对剩余 comparison 索引执行 `i > pageIndex ? i - 1 : i`。

- [ ] **Step 8: 运行纯函数测试并提交**

Run:

```powershell
cd frontend
pnpm exec vitest run ../tests/unit/frontend/lib/page-sequence.test.ts
git add package.json pnpm-lock.yaml src/lib/page-sequence.ts ../tests/unit/frontend/lib/page-sequence.test.ts
git commit -s -m "feat(editor): 新增页面编排序列模型" -m "Co-Authored-By: Codex Opus 4.7 <noreply@anthropic.com>"
```

Expected: 测试 PASS；提交包含依赖、锁文件、纯函数与测试。

---

### Task 2: RadarEditor 原子状态更新

**Files:**
- Modify: `frontend/src/components/editor/RadarEditor.tsx`
- Modify: `tests/unit/frontend/components/editor/RadarEditor.test.tsx`

**Interfaces:**
- Consumes Task 1 的 `reorderPageSequence`、`duplicatePageInSequence`、`removePageFromSequence`。
- Produces `onReorderPageSequence(activeId, overId)` 给 `GlobalConfigEditor`。

- [ ] **Step 1: 扩展 mock GlobalConfigEditor 并写失败测试**

在测试 mock 中新增：

```tsx
<button
  data-testid="reorder-group"
  onClick={() => p.onReorderPageSequence("comparison:0:1", "comparison:2:3")}
>
  reorder-group
</button>
```

写断言：载入 `makeRichConfig()` 后移动 `{0,1}` 到 `{2,3}`，页面顺序变成 `P2,P3,P0,P1`，两组 comparisons 分别为 `{0,1}` 和 `{2,3}`；当前选中页仍指向原页面对象的新索引。

- [ ] **Step 2: 运行目标测试确认红灯**

```powershell
cd frontend
pnpm exec vitest run ../tests/unit/frontend/components/editor/RadarEditor.test.tsx
```

Expected: FAIL，因为 `onReorderPageSequence` 尚未提供。

- [ ] **Step 3: 用纯函数替换旧移动/复制/删除实现**

新增：

```ts
const reorderPageSequence = (activeId: string, overId: string) => {
  setConfig((prev) => {
    const result = reorderSequence(prev, activePageIndex, activeId, overId);
    setActivePageIndex(result.activePageIndex);
    return { ...prev, pages: result.pages, comparisons: result.comparisons };
  });
};
```

同理让 `duplicatePage` 和 `removePage` 使用 Task 1 纯函数；删除后的 active index 从结果设置。移除不再使用的 `remapComparisons` 与 `movePage`。

- [ ] **Step 4: 运行测试并提交**

```powershell
cd frontend
pnpm exec vitest run ../tests/unit/frontend/components/editor/RadarEditor.test.tsx ../tests/unit/frontend/lib/page-sequence.test.ts
git add src/components/editor/RadarEditor.tsx ../tests/unit/frontend/components/editor/RadarEditor.test.tsx
git commit -s -m "refactor(editor): 统一页面编排状态更新" -m "Co-Authored-By: Codex Opus 4.7 <noreply@anthropic.com>"
```

Expected: 两个测试文件 PASS。

---

### Task 3: PageSequenceEditor 拖拽与操作组件

**Files:**
- Create: `frontend/src/components/editor/PageSequenceEditor.tsx`
- Create: `tests/unit/frontend/components/editor/PageSequenceEditor.test.tsx`

**Interfaces:**
- Consumes `config`, `activePageIndex`, `onSetActive`, `onAddPage`, `onDuplicatePage`, `onRemovePage`, `onReorderPageSequence`, `onToggleComparison`。
- Produces one-row page bars and atomic comparison groups; no config state is stored locally except active drag ID and pending delete index。

- [ ] **Step 1: 写静态交互失败测试**

测试至少包含：

```ts
it("把对比页渲染在同一绑定组且操作位于各自 bar", () => {
  renderEditor(makeConfig(["A", "B", "C"], [[0, 1]]));
  expect(screen.getByRole("group", { name: "对比绑定：A 与 B" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "解除 A 与 B 的对比" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "B 已参与对比" })).toBeDisabled();
});

it("点击绑定成员删除先打开确认，确认后只回调该索引", async () => {
  const onRemovePage = vi.fn();
  renderEditor(makeConfig(["A", "B"], [[0, 1]]), { onRemovePage });
  await user.click(screen.getByRole("button", { name: "删除 B" }));
  expect(screen.getByText(/解除 A 与 B 的对比/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "确认删除" }));
  expect(onRemovePage).toHaveBeenCalledWith(1);
});
```

- [ ] **Step 2: 运行测试确认红灯**

```powershell
cd frontend
pnpm exec vitest run ../tests/unit/frontend/components/editor/PageSequenceEditor.test.tsx
```

Expected: FAIL，因为组件不存在。

- [ ] **Step 3: 实现静态 bar、组与确认弹窗**

使用 `GripVertical`、`Copy`、`Trash2`、`Link2`、`Unlink2` 和现有 `ConfirmDialog`。每个 bar 的非操作区域调用 `onSetActive`，操作按钮调用 `stopPropagation()`。绑定组首项显示解除，次项禁用；普通末页和下一项非普通页时禁用对比。

核心 props：

```ts
type PageSequenceEditorProps = {
  config: MultiPageConfig;
  activePageIndex: number;
  onSetActive: (index: number) => void;
  onAddPage: () => void;
  onDuplicatePage: (index: number) => void;
  onRemovePage: (index: number) => void;
  onReorderPageSequence: (activeId: string, overId: string) => void;
  onToggleComparison: (firstIndex: number, secondIndex: number) => void;
};
```

- [ ] **Step 4: 写拖拽失败测试**

mock `@dnd-kit/core` 捕获 `onDragStart/onDragEnd/onDragCancel`，断言：

```ts
capturedOnDragEnd({ active: { id: "comparison:0:1" }, over: { id: "page:2" } });
expect(onReorderPageSequence).toHaveBeenCalledWith("comparison:0:1", "page:2");

capturedOnDragEnd({ active: { id: "page:2" }, over: null });
expect(onReorderPageSequence).not.toHaveBeenCalled();
```

- [ ] **Step 5: 确认红灯后接入 sortable**

使用 Context7 核对过的经典 API：

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);

<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={({ active }) => setActiveId(String(active.id))}
  onDragCancel={() => setActiveId(null)}
  onDragEnd={({ active, over }) => {
    setActiveId(null);
    if (over && active.id !== over.id) {
      onReorderPageSequence(String(active.id), String(over.id));
    }
  }}
>
  <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
    {items.map(renderSequenceItem)}
  </SortableContext>
  <DragOverlay>{activeItem ? <SequenceItemPreview item={activeItem} /> : null}</DragOverlay>
</DndContext>
```

`useSortable` 的 listeners 只挂到拖拽柄，柄设置 `touch-action: none`；自定义 announcements 描述页面/对比组和落点，Esc 取消由 KeyboardSensor 处理。

- [ ] **Step 6: 运行组件测试并提交**

```powershell
cd frontend
pnpm exec vitest run ../tests/unit/frontend/components/editor/PageSequenceEditor.test.tsx
git add src/components/editor/PageSequenceEditor.tsx ../tests/unit/frontend/components/editor/PageSequenceEditor.test.tsx
git commit -s -m "feat(editor): 新增可拖拽页面编排组件" -m "Co-Authored-By: Codex Opus 4.7 <noreply@anthropic.com>"
```

Expected: PASS，且新增组件单文件覆盖率不低于 60%。

---

### Task 4: 方案 A 全局布局、音乐披露与时长摘要

**Files:**
- Modify: `frontend/src/components/editor/GlobalConfigEditor.tsx`
- Modify: `frontend/src/components/files/AssetSelector.tsx`
- Modify: `tests/unit/frontend/components/editor/GlobalConfigEditor.test.tsx`
- Modify: `tests/unit/frontend/components/files/AssetSelector.test.tsx`

**Interfaces:**
- Consumes Task 3 的 `PageSequenceEditor`。
- `AssetSelector` 新增可选 `embedded?: boolean`；默认 `false`，不改变其他调用方。

- [ ] **Step 1: 写布局与披露失败测试**

在 `GlobalConfigEditor.test.tsx` mock `PageSequenceEditor` 并断言：

```ts
expect(screen.getByRole("button", { name: "添加页面" })).toBeVisible();
expect(screen.getByText("总时长")).toBeVisible();
expect(screen.getByText("720 帧")).toBeVisible();
expect(screen.queryByText(/页1/)).not.toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "展开时长明细" }));
expect(screen.getByText(/页1/)).toBeVisible();
await user.click(screen.getByRole("button", { name: "选择背景音乐" }));
expect(screen.getByTestId("asset-selector")).toBeVisible();
```

在 `AssetSelector.test.tsx` 断言 `embedded` 时不重复渲染“背景音乐”标题，但刷新、上传、资源列表和播放能力仍存在。

- [ ] **Step 2: 运行两个测试确认红灯**

```powershell
cd frontend
pnpm exec vitest run ../tests/unit/frontend/components/editor/GlobalConfigEditor.test.tsx ../tests/unit/frontend/components/files/AssetSelector.test.tsx
```

Expected: FAIL，原因是新布局、披露按钮或 `embedded` prop 尚不存在。

- [ ] **Step 3: 实现 AssetSelector embedded 变体**

扩展 props：

```ts
interface AssetSelectorProps {
  // existing props
  embedded?: boolean;
}
```

当 `embedded` 为 true 时，顶部行只显示刷新/上传操作并通过 `aria-label` 命名，不再显示 `headerLabel`；其余上传进度、错误、资源列表、播放和清除选择逻辑不变。

- [ ] **Step 4: 重构 GlobalConfigEditor**

- 移除横向页面 chip 和上/下移动按钮，渲染 `PageSequenceEditor`。
- 将 `toggleComparison` 保留为配置级操作并传给新组件。
- 增加 `musicExpanded` 与 `durationExpanded` 本地 UI 状态。
- 音乐行展示 `Music2`、当前 URL 文件名或“未添加音乐”，按钮文案为“选择背景音乐/收起音乐选择器”。
- 时长摘要展示 `总时长 {seconds} 秒`、`{frames} 帧`、`{pages} 页`；逐页明细仅在展开时计算并展示。
- 全局预览按钮紧跟摘要，并显示 `全局预览 · N 页拼接`。

- [ ] **Step 5: 运行测试并提交**

```powershell
cd frontend
pnpm exec vitest run ../tests/unit/frontend/components/editor/GlobalConfigEditor.test.tsx ../tests/unit/frontend/components/files/AssetSelector.test.tsx ../tests/unit/frontend/components/editor/PageSequenceEditor.test.tsx
git add src/components/editor/GlobalConfigEditor.tsx src/components/files/AssetSelector.tsx ../tests/unit/frontend/components/editor/GlobalConfigEditor.test.tsx ../tests/unit/frontend/components/files/AssetSelector.test.tsx
git commit -s -m "refactor(editor): 重排全局编排与摘要布局" -m "Co-Authored-By: Codex Opus 4.7 <noreply@anthropic.com>"
```

Expected: 三个测试文件 PASS。

---

### Task 5: 开发集成与真实用户旅程

**Files:**
- Create: `tests/dev-integration/frontend/components/editor/GlobalConfigEditor.test.tsx`
- Create: `tests/testenv-integration/frontend/page-sequence-reorder.spec.ts`

**Interfaces:**
- Dev integration 使用真实 `GlobalConfigEditor + PageSequenceEditor` 与内存 state harness，不访问进程外网络。
- Playwright 使用现有 `registerAndLanding(page)`，配置只从测试系统 baseURL/后端/库获得。

- [ ] **Step 1: 写 dev-integration 失败测试**

用 state harness 渲染 4 页、`1+2` 对比组，触发 `onReorderPageSequence` 后断言页面文本顺序、对比提示、总时长摘要和全局预览回调收到同一份更新配置。AssetSelector 可 mock，拖拽库仅触发公开的 drag-end handler，不 mock业务纯函数。

- [ ] **Step 2: 运行 dev-integration 目标测试确认红灯并修正接线**

```powershell
cd frontend
pnpm exec vitest run --config vitest.integration.config.ts ../tests/dev-integration/frontend/components/editor/GlobalConfigEditor.test.tsx
```

Expected: 初次因缺失 harness 接线或目标行为失败；最小修正后 PASS。

- [ ] **Step 3: 写 Playwright 用户旅程**

`page-sequence-reorder.spec.ts`：

```ts
test.beforeEach(async ({ page }) => {
  await registerAndLanding(page);
  await page.getByRole("tab", { name: "全局" }).click();
});

test("对比组只能整体拖动且键盘可重排", async ({ page }) => {
  await page.getByRole("button", { name: "添加页面" }).click();
  await page.getByRole("button", { name: "与下一页对比" }).first().click();
  const group = page.getByRole("group", { name: /对比绑定/ });
  await expect(group).toContainText("整组拖动");
  const handle = group.getByRole("button", { name: /拖动对比组/ });
  await handle.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await expect(group).toContainText(/01|02/);
});
```

- [ ] **Step 4: 运行 unit 与 dev-integration 全套并提交**

```powershell
cd frontend
pnpm test:unit
pnpm test:integration
git add ../tests/dev-integration/frontend/components/editor/GlobalConfigEditor.test.tsx ../tests/testenv-integration/frontend/page-sequence-reorder.spec.ts
git commit -s -m "test(editor): 覆盖页面编排用户旅程" -m "Co-Authored-By: Codex Opus 4.7 <noreply@anthropic.com>"
```

Expected: unit 与 dev-integration 100% PASS，覆盖率满足每文件 60%（高于项目兜底 50%）。

---

### Task 6: 最终验证、审查与 PR

**Files:**
- Modify only if verification/review finds a defect; every defect receives a failing regression test first。

- [ ] **Step 1: 运行格式、lint、测试与生产构建**

```powershell
cd frontend
pnpm exec prettier --check src/components/editor/PageSequenceEditor.tsx src/components/editor/GlobalConfigEditor.tsx src/components/editor/RadarEditor.tsx src/components/files/AssetSelector.tsx src/lib/page-sequence.ts ../tests/unit/frontend/components/editor/PageSequenceEditor.test.tsx ../tests/unit/frontend/components/editor/GlobalConfigEditor.test.tsx ../tests/unit/frontend/components/editor/RadarEditor.test.tsx ../tests/unit/frontend/components/files/AssetSelector.test.tsx ../tests/unit/frontend/lib/page-sequence.test.ts ../tests/dev-integration/frontend/components/editor/GlobalConfigEditor.test.tsx ../tests/testenv-integration/frontend/page-sequence-reorder.spec.ts
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm build
```

Expected: 所有命令 exit 0；unit/dev-integration 无失败；生产构建成功。

- [ ] **Step 2: 条件允许时运行 testenv Playwright**

仅当测试系统已注入真实环境并允许本地运行：

```powershell
cd frontend
pnpm exec playwright test ../tests/testenv-integration/frontend/page-sequence-reorder.spec.ts
```

Expected: PASS。若环境未提供，记录未运行原因，不硬编码或猜测连接配置。

- [ ] **Step 3: 请求代码审查并处理反馈**

以 `origin/main` 为 BASE、当前 HEAD 为 HEAD，审查设计文档验收标准、状态映射、无障碍、测试真实性和不相关 diff。Critical/Important 反馈必须先写失败测试再修复。

- [ ] **Step 4: 检查提交、diff 与工作区**

```powershell
git status --short
git diff --check origin/main...HEAD
git log --oneline --decorate origin/main..HEAD
git diff --stat origin/main...HEAD
```

Expected: worktree clean；diff 只包含设计、worktree ignore、依赖、页面编排实现和对应测试。

- [ ] **Step 5: 推送并创建 PR**

```powershell
git push -u origin feat/global-page-sequence-dnd
gh pr create --base main --head feat/global-page-sequence-dnd --title "feat(editor): 重构全局页面拖拽编排" --body-file .pr-body.md
```

PR 正文必须包含：方案 A 摘要、对比原子组规则、复制/删除规则、测试命令与结果、Playwright 是否运行、设计文档链接；创建后删除未跟踪的临时 `.pr-body.md` 或在创建前将其放到工作树外的临时目录。

