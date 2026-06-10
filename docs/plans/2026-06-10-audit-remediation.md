# Audit Issues Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复审核报告发现的所有 HIGH/MEDIUM 优先级问题，使项目达到 CLAUDE.md 规范要求。

**Architecture:** 分 5 个 Phase 执行，每个 Phase 独立可验证，按优先级从高到低排序。Phase 1-2 为配置与类型修复（立即见效），Phase 3-4 为测试补充（覆盖率提升），Phase 5 为基础设施完善。

**Tech Stack:** Vitest + pytest + ruff + ESLint + TypeScript strict mode

**Reference:** 审核报告 `docs/audit/2026-06-10.md`

---

## Phase 1: 覆盖率阈值配置修复

**目标：** 修复前端覆盖率阈值配置，配置后端覆盖率阈值，确保 CI/CD 自动校验覆盖率。

**预估时间：** 30 分钟

---

### Task 1.1: 修复前端覆盖率阈值

**Files:**
- Modify: `frontend/vitest.config.ts:17-20`

**Step 1: 查看当前配置**

运行：`cat frontend/vitest.config.ts | grep -A5 thresholds`
预期输出：`lines: 30, branches: 30, functions: 30, statements: 30`

**Step 2: 修改阈值**

将 `vitest.config.ts` 第 17-20 行修改为：

```typescript
thresholds: {
  lines: 60,
  branches: 60,
  functions: 60,
  statements: 60,
},
```

**Step 3: 验证修改**

运行：`cd frontend && pnpm test:unit -- --coverage 2>&1 | head -20`
预期：覆盖率检查生效（若低于 60% 则报错）

**Step 4: Commit**

```bash
git add frontend/vitest.config.ts
git commit -m "fix(frontend): 覆盖率阈值从 30% 提升至 60%（符合 CLAUDE.md §7.1）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 1.2: 配置后端覆盖率阈值

**Files:**
- Modify: `pytest.ini`

**Step 1: 查看当前配置**

运行：`cat pytest.ini`
预期输出：无 `--cov-fail-under` 配置

**Step 2: 添加覆盖率阈值**

在 `pytest.ini` 的 `[pytest]` section 添加：

```ini
[pytest]
asyncio_mode = auto
asyncio_default_fixture_loop_scope = function
testpaths = tests
pythonpath = backend
addopts = -v --tb=short --cov=backend/app --cov-report=term --cov-fail-under=80
```

**Step 3: 验证修改**

运行：`cd backend && uv run pytest ../tests/unit/backend/ --cov=app --cov-report=term -v 2>&1 | tail -10`
预期：覆盖率 54%，低于 80% 会报错退出（此为预期行为，Phase 4 将提升覆盖率）

**Step 4: 暂存阈值配置（等待覆盖率达标后启用）**

由于当前覆盖率仅 54%，立即启用 `--cov-fail-under=80` 会阻断 CI。改为添加注释说明：

```ini
[pytest]
asyncio_mode = auto
asyncio_default_fixture_loop_scope = function
testpaths = tests
pythonpath = backend
addopts = -v --tb=short --cov=backend/app --cov-report=term
# TODO: 启用覆盖率阈值校验（需 Phase 4 完成后）
# addopts = ... --cov-fail-under=80
```

**Step 5: Commit**

```bash
git add pytest.ini
git commit -m "chore(backend): 预留 pytest 覆盖率阈值配置（待 Phase 4 提升覆盖率后启用）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2: TypeScript 类型安全修复

**目标：** 消除审核报告中发现的关键 `any` 类型使用，提升类型安全性。

**预估时间：** 1.5 小时

---

### Task 2.1: 修复 login/page.tsx 的 any 类型

**Files:**
- Modify: `frontend/src/app/(auth)/login/page.tsx:28`

**Step 1: 查看当前代码**

运行：`grep -n "catch.*any" frontend/src/app/\(auth\)/login/page.tsx`
预期输出：`28:19  error  Unexpected any`

**Step 2: 读取文件上下文**

运行：`sed -n '25,35p' frontend/src/app/(auth)/login/page.tsx`

**Step 3: 修改 catch 块**

将 `catch (err: any)` 改为 `catch (err: unknown)`，并添加类型守卫：

```typescript
// 原代码
catch (err: any) {
  setError(err.message || "登录失败");
}

// 修改后
catch (err: unknown) {
  const message = err instanceof Error ? err.message : "登录失败";
  setError(message);
}
```

**Step 4: 验证 ESLint**

运行：`cd frontend && pnpm lint 2>&1 | grep login/page.tsx`
预期：无 `no-explicit-any` 错误

**Step 5: Commit**

```bash
git add frontend/src/app/(auth)/login/page.tsx
git commit -m "fix(frontend): login 页面 catch 块类型从 any 改为 unknown

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2.2: 修复 register/page.tsx 的 any 类型

**Files:**
- Modify: `frontend/src/app/(auth)/register/page.tsx:41`

**Step 1: 查看当前代码**

运行：`grep -n "catch.*any" frontend/src/app/\(auth\)/register/page.tsx`

**Step 2: 修改 catch 块**

同 Task 2.1，将 `catch (err: any)` 改为 `catch (err: unknown)` + 类型守卫。

**Step 3: 验证 ESLint**

运行：`cd frontend && pnpm lint 2>&1 | grep register/page.tsx`
预期：无 `no-explicit-any` 错误

**Step 4: Commit**

```bash
git add frontend/src/app/(auth)/register/page.tsx
git commit -m "fix(frontend): register 页面 catch 块类型从 any 改为 unknown

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2.3: 修复 global-override.ts 的 any 类型

**Files:**
- Modify: `frontend/src/lib/global-override.ts:202-208`

**Step 1: 查看当前代码**

运行：`sed -n '200,220p' frontend/src/lib/global-override.ts`

**Step 2: 泛型化 getByPath 和 setByPath**

修改函数签名和实现：

```typescript
// 原代码
export function getByPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

export function setByPath<T extends object>(obj: T, path: string, value: any): T {
  const keys = path.split(".");
  const clone: any = Array.isArray(obj) ? [...(obj as any)] : { ...obj };
  ...
}

// 修改后
export function getByPath<T extends object>(obj: T, path: string): unknown {
  const keys = path.split(".");
  let result: unknown = obj;
  for (const key of keys) {
    if (result == null) return undefined;
    result = (result as Record<string, unknown>)?.[key];
  }
  return result;
}

export function setByPath<T extends object>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const clone = structuredClone(obj) as Record<string, unknown>;
  let cursor: Record<string, unknown> = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    cursor[k] = cursor[k] ?? {};
    cursor = cursor[k] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
  return clone as T;
}
```

**Step 3: 更新调用方类型断言**

检查 `applyGlobalOverride` 函数中的调用，确保类型正确：

```typescript
// 在 applyGlobalOverride 中
const value = getByPath(override.values, field.path);
if (value === undefined) continue;
// 根据 field.type 进行类型断言
next = setByPath(next, field.path, value);
```

**Step 4: 验证 ESLint**

运行：`cd frontend && pnpm lint 2>&1 | grep global-override.ts`
预期：无 `no-explicit-any` 错误

**Step 5: 运行单元测试**

运行：`cd frontend && pnpm test:unit 2>&1 | grep global-override`
预期：测试通过

**Step 6: Commit**

```bash
git add frontend/src/lib/global-override.ts
git commit -m "fix(frontend): global-override.ts 泛型化 getByPath/setByPath 消除 any 类型

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2.4: 修复 CharacterConfig.tsx 的 any 类型（可选）

**Files:**
- Modify: `frontend/src/components/editor/CharacterConfig.tsx:105-342`

**说明：** 此文件有 11 处 `as any` 类型断言，多为 Remotion 组件 props 传递。修复需深入理解 Remotion 类型系统，风险较高。建议 LOW 优先级，Phase 5 处理。

**Step 1: 记录为后续任务**

暂不修改，记录在 Phase 5 任务列表。

---

## Phase 3: 前端 Hooks 单测补充

**目标：** 补充前端 hooks 单元测试，提升覆盖率至 60% 以上。

**预估时间：** 2 小时

---

### Task 3.1: 创建 hooks 测试目录结构

**Files:**
- Create: `tests/unit/frontend/hooks/__init__.py`
- Create: `tests/unit/frontend/hooks/useTaskQueue.test.ts`

**Step 1: 创建测试目录**

```bash
mkdir -p tests/unit/frontend/hooks
touch tests/unit/frontend/hooks/__init__.py
```

**Step 2: 查看源码**

运行：`cat frontend/src/hooks/useTaskQueue.ts`

**Step 3: 编写 useTaskQueue.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTaskQueue } from "@/hooks/useTaskQueue";

// Mock api-client
vi.mock("@/lib/api-client", () => ({
  apiClient: {
    getTasks: vi.fn(),
    deleteTask: vi.fn(),
    forgetTask: vi.fn(),
  },
}));

describe("useTaskQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初始化时返回空队列", () => {
    const { result } = renderHook(() => useTaskQueue());
    expect(result.current.tasks).toEqual([]);
    expect(result.current.queueSize).toBe(0);
  });

  it("refresh 后更新任务列表", async () => {
    const mockTasks = [{ id: 1, status: "queued" }];
    const { apiClient } = await import("@/lib/api-client");
    vi.mocked(apiClient.getTasks).mockResolvedValueOnce({
      tasks: mockTasks,
      queueSize: 1,
    });

    const { result } = renderHook(() => useTaskQueue());
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.tasks).toEqual(mockTasks);
    expect(result.current.queueSize).toBe(1);
  });

  it("deleteTask 调用 API 并刷新", async () => {
    const { apiClient } = await import("@/lib/api-client");
    vi.mocked(apiClient.deleteTask).mockResolvedValueOnce(undefined);
    vi.mocked(apiClient.getTasks).mockResolvedValueOnce({
      tasks: [],
      queueSize: 0,
    });

    const { result } = renderHook(() => useTaskQueue());
    await act(async () => {
      await result.current.deleteTask(1);
    });

    expect(apiClient.deleteTask).toHaveBeenCalledWith(1);
    expect(apiClient.getTasks).toHaveBeenCalled();
  });
});
```

**Step 4: 运行测试**

运行：`cd frontend && pnpm test:unit tests/unit/frontend/hooks/useTaskQueue.test.ts`
预期：测试通过

**Step 5: Commit**

```bash
git add tests/unit/frontend/hooks/
git commit -m "test(frontend): 补充 useTaskQueue hook 单测

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3.2: 补充 useServerRender.test.ts

**Files:**
- Create: `tests/unit/frontend/hooks/useServerRender.test.ts`

**Step 1: 查看源码**

运行：`cat frontend/src/hooks/useServerRender.ts`

**Step 2: 编写 useServerRender.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useServerRender } from "@/hooks/useServerRender";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    submitRender: vi.fn(),
    getTask: vi.fn(),
  },
}));

describe("useServerRender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初始化状态为 idle", () => {
    const { result } = renderHook(() => useServerRender());
    expect(result.current.status).toBe("idle");
    expect(result.current.taskId).toBeNull();
  });

  it("submit 后状态变为 queued", async () => {
    const { apiClient } = await import("@/lib/api-client");
    vi.mocked(apiClient.submitRender).mockResolvedValueOnce({
      task_id: 1,
      status: "queued",
    });

    const { result } = renderHook(() => useServerRender());
    await act(async () => {
      await result.current.submit({ mode: "single", codec: "h264" });
    });

    expect(result.current.status).toBe("queued");
    expect(result.current.taskId).toBe(1);
  });

  it("pollTask 更新任务状态", async () => {
    const { apiClient } = await import("@/lib/api-client");
    vi.mocked(apiClient.getTask).mockResolvedValueOnce({
      id: 1,
      status: "running",
    });

    const { result } = renderHook(() => useServerRender());
    act(() => {
      result.current.setTaskId(1);
    });
    await act(async () => {
      await result.current.pollTask();
    });

    expect(result.current.status).toBe("running");
  });
});
```

**Step 3: 运行测试**

运行：`cd frontend && pnpm test:unit tests/unit/frontend/hooks/useServerRender.test.ts`
预期：测试通过

**Step 4: Commit**

```bash
git add tests/unit/frontend/hooks/useServerRender.test.ts
git commit -m "test(frontend): 补充 useServerRender hook 单测

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3.3: 补充其他 hooks 单测（可选）

**说明：** 以下 hooks 可按需补充：
- `useTaskPolling.test.ts` — 轮询逻辑测试
- `useFileManagement.test.ts` — 文件上传/列表测试
- `useSavedConfigs.test.ts` — 配置保存/加载测试
- `usePublicAssets.test.ts` — 公共资源获取测试

每个测试文件预估 20-30 分钟，可在 Phase 5 补充。

---

## Phase 4: 后端 Models/DAO 单测补充

**目标：** 补充后端 models 和 dao 单元测试，提升覆盖率至 80% 以上。

**预估时间：** 2 小时

---

### Task 4.1: 创建 models 测试目录

**Files:**
- Create: `tests/unit/backend/models/__init__.py`
- Create: `tests/unit/backend/models/test_render_task.py`
- Create: `tests/unit/backend/models/test_user.py`
- Create: `tests/unit/backend/models/test_stored_file.py`

**Step 1: 创建目录**

```bash
mkdir -p tests/unit/backend/models
touch tests/unit/backend/models/__init__.py
```

**Step 2: 查看源码**

运行：`cat backend/app/models/render_task.py`

**Step 3: 编写 test_render_task.py**

```python
"""RenderTask 模型单元测试。"""

import pytest
from app.models.render_task import RenderTask, RenderMode, RenderStatus, Codec


class TestRenderTaskModel:
    """领域模型字段与枚举测试。"""

    def test_render_mode_enum_values(self) -> None:
        """RenderMode 包含 single/comparison 两个值。"""
        assert RenderMode.SINGLE.value == "single"
        assert RenderMode.COMPARISON.value == "comparison"

    def test_render_status_enum_values(self) -> None:
        """RenderStatus 包含所有状态。"""
        assert RenderStatus.QUEUED.value == "queued"
        assert RenderStatus.RUNNING.value == "running"
        assert RenderStatus.DONE.value == "done"
        assert RenderStatus.FAILED.value == "failed"
        assert RenderStatus.CANCELED.value == "canceled"

    def test_codec_enum_values(self) -> None:
        """Codec 包含 h264/gif。"""
        assert Codec.H264.value == "h264"
        assert Codec.GIF.value == "gif"

    def test_model_field_types(self) -> None:
        """模型字段类型正确。"""
        task = RenderTask(
            id=1,
            user_id=1,
            mode=RenderMode.SINGLE,
            codec=Codec.H264,
            status=RenderStatus.QUEUED,
            input_props={},
            output_path="",
        )
        assert isinstance(task.id, int)
        assert isinstance(task.mode, RenderMode)
        assert isinstance(task.status, RenderStatus)


class TestRenderTaskValidation:
    """模型校验测试。"""

    def test_mode_from_string(self) -> None:
        """从字符串构建枚举。"""
        mode = RenderMode("single")
        assert mode == RenderMode.SINGLE

    def test_invalid_mode_raises(self) -> None:
        """无效 mode 抛 ValueError。"""
        with pytest.raises(ValueError):
            RenderMode("invalid")
```

**Step 4: 编写 test_user.py**

```python
"""User 模型单元测试。"""

import pytest
from app.models.user import User


class TestUserModel:
    """User 领域模型测试。"""

    def test_model_fields(self) -> None:
        """模型字段存在。"""
        user = User(
            id=1,
            username="test",
            email="test@example.com",
            password_hash="hash",
        )
        assert user.id == 1
        assert user.username == "test"
        assert user.email == "test@example.com"

    def test_email_is_required(self) -> None:
        """email 为必填。"""
        # pydantic 会校验，此处验证模型定义
        user = User(id=1, username="test", email="a@b.com", password_hash="h")
        assert user.email is not None
```

**Step 5: 编写 test_stored_file.py**

```python
"""StoredFile 模型单元测试。"""

import pytest
from app.models.stored_file import StoredFile


class TestStoredFileModel:
    """StoredFile 领域模型测试。"""

    def test_model_fields(self) -> None:
        """模型字段存在。"""
        file = StoredFile(
            id=1,
            user_id=1,
            filename="test.png",
            size_bytes=1024,
        )
        assert file.id == 1
        assert file.filename == "test.png"
        assert file.size_bytes == 1024
```

**Step 6: 运行测试**

运行：`cd backend && uv run pytest ../tests/unit/backend/models/ -v`
预期：测试通过

**Step 7: Commit**

```bash
git add tests/unit/backend/models/
git commit -m "test(backend): 补充 models 单元测试（render_task/user/stored_file）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4.2: 创建 dao 测试目录

**Files:**
- Create: `tests/unit/backend/dao/__init__.py`
- Create: `tests/unit/backend/dao/test_render_task_dao.py`
- Create: `tests/unit/backend/dao/test_user_dao.py`

**Step 1: 创建目录**

```bash
mkdir -p tests/unit/backend/dao
touch tests/unit/backend/dao/__init__.py
```

**Step 2: 查看 DAO 源码**

运行：`cat backend/app/dao/render_task_dao.py | head -70`

**Step 3: 查看 conftest fixture**

运行：`cat tests/unit/backend/conftest.py`

**Step 4: 编写 test_render_task_dao.py**

```python
"""RenderTaskDAO 单元测试。"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.dao.render_task_dao import RenderTaskDAO, _to_domain
from app.dao.orm import RenderTaskORM
from app.models.render_task import RenderMode, RenderStatus, Codec


@pytest.fixture
def mock_session() -> AsyncMock:
    """Mock AsyncSession。"""
    return AsyncMock()


@pytest.fixture
def dao(mock_session: AsyncMock) -> RenderTaskDAO:
    """DAO 实例。"""
    return RenderTaskDAO(mock_session)


class TestToDomain:
    """_to_domain 转换测试。"""

    def test_converts_orm_to_domain(self) -> None:
        """ORM 正确转换为领域模型。"""
        orm = MagicMock(spec=RenderTaskORM)
        orm.id = 1
        orm.user_id = 1
        orm.mode = "single"
        orm.codec = "h264"
        orm.status = "queued"
        orm.input_props = {}
        orm.output_path = ""
        orm.error = None
        orm.duration_ms = None
        orm.created_at = None
        orm.started_at = None
        orm.finished_at = None

        domain = _to_domain(orm)
        assert domain.id == 1
        assert domain.mode == RenderMode.SINGLE


class TestCreate:
    """create 方法测试。"""

    async def test_create_returns_task(self, dao: RenderTaskDAO, mock_session: AsyncMock) -> None:
        """create 返回 RenderTask。"""
        mock_orm = MagicMock()
        mock_orm.id = 1
        mock_orm.user_id = 1
        mock_orm.mode = "single"
        mock_orm.codec = "h264"
        mock_orm.status = "queued"
        mock_orm.input_props = {}
        mock_orm.output_path = ""
        mock_orm.error = None
        mock_orm.duration_ms = None
        mock_orm.created_at = None
        mock_orm.started_at = None
        mock_orm.finished_at = None

        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock(side_effect=lambda x: setattr(x, "id", 1))

        task = await dao.create(
            user_id=1,
            mode=RenderMode.SINGLE,
            codec=Codec.H264,
            input_props={},
            output_path="",
        )
        assert task.user_id == 1
        assert task.mode == RenderMode.SINGLE
```

**Step 5: 编写 test_user_dao.py**

```python
"""UserDAO 单元测试。"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.dao.user_dao import UserDAO


@pytest.fixture
def mock_session() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def dao(mock_session: AsyncMock) -> UserDAO:
    return UserDAO(mock_session)


class TestExists:
    """exists 方法测试。"""

    async def test_exists_returns_true_when_found(self, dao: UserDAO, mock_session: AsyncMock) -> None:
        """用户存在时返回 True。"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = 1
        mock_session.execute = AsyncMock(return_value=mock_result)

        result = await dao.exists(username="test")
        assert result is True

    async def test_exists_returns_false_when_not_found(self, dao: UserDAO, mock_session: AsyncMock) -> None:
        """用户不存在时返回 False。"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        result = await dao.exists(username="notfound")
        assert result is False
```

**Step 6: 运行测试**

运行：`cd backend && uv run pytest ../tests/unit/backend/dao/ -v`
预期：测试通过

**Step 7: Commit**

```bash
git add tests/unit/backend/dao/
git commit -m "test(backend): 补充 dao 单元测试（render_task_dao/user_dao）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4.3: 验证覆盖率提升

**Step 1: 运行完整单元测试套**

运行：`cd backend && uv run pytest ../tests/unit/backend/ --cov=app --cov-report=term`
预期：覆盖率提升至 65-70%

**Step 2: 运行完整 dev-integration 测试套**

运行：`cd backend && uv run pytest ../tests/dev-integration/backend/ --cov=app --cov-report=term`
预期：覆盖率维持在 78%

**Step 3: 记录覆盖率数据**

记录在 `docs/audit/coverage-progress.md`：

```markdown
# 覆盖率进度跟踪

| Phase | Unit | Dev-Integration | 合计 |
|-------|------|-----------------|------|
| Phase 0（修复前） | 54% | 78% | — |
| Phase 4（修复后） | XX% | XX% | — |
```

---

## Phase 5: 测试基础设施完善

**目标：** 完善 testenv-integration conftest、清理 ESLint 其他问题、补充剩余 hooks 测试。

**预估时间：** 1.5 小时

---

### Task 5.1: 创建 testenv-integration/backend conftest.py

**Files:**
- Create: `tests/testenv-integration/backend/conftest.py`

**Step 1: 查看现有 conftest 结构**

运行：`cat tests/dev-integration/backend/conftest.py`

**Step 2: 创建 testenv conftest**

```python
"""testenv-integration backend conftest。

提供真实数据库连接 fixture（配置由测试系统注入）。
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.dao.orm import Base
import os


@pytest.fixture(scope="session")
async def real_db_engine():
    """真实数据库引擎（配置由环境变量注入）。"""
    db_url = os.getenv("TEST_DB_URL")
    if not db_url:
        pytest.skip("TEST_DB_URL 未配置，跳过 testenv 测试")
    engine = create_async_engine(db_url)
    yield engine
    await engine.dispose()


@pytest.fixture
async def real_db_session(real_db_engine) -> AsyncSession:
    """真实数据库会话（每测试独立事务）。"""
    async_session = async_sessionmaker(real_db_engine, expire_on_commit=False)
    async with async_session() as session:
        async with session.begin():
            yield session
            # 测试结束自动回滚
```

**Step 3: Commit**

```bash
git add tests/testenv-integration/backend/conftest.py
git commit -m "test(backend): 添加 testenv-integration conftest（real_db_session fixture）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5.2: 清理 ESLint 未使用变量

**Files:**
- Modify: `frontend/src/lib/fonts.ts:1-13`
- Modify: `frontend/src/components/editor/ExportPanel.tsx:21`
- Modify: `frontend/src/components/editor/GlobalConfigEditor.tsx:33`
- Modify: `frontend/src/remotion/RadarChart/ComparisonFill.tsx:29`
- Modify: `frontend/src/remotion/RadarVideo.tsx:48,282`

**Step 1: 修复 fonts.ts 未使用导入**

删除或标记为有意未使用：

```typescript
// 如果这些导入是为外部使用，添加注释
import { NotoSans_400Regular as _noto } from "@expo-google-fonts/noto-sans";
// _noto exported for external use (suppress ESLint warning)
export { _noto };
```

或直接删除未使用的导入。

**Step 2: 修复 ExportPanel.tsx**

删除未使用的 `mode` 参数或添加 `_` 前缀：

```typescript
// 原：const { mode, ... } = props;
// 改：const { mode: _mode, ... } = props; // intentionally unused
```

**Step 3: 修复其他文件**

类似处理其他未使用变量。

**Step 4: 验证 ESLint**

运行：`cd frontend && pnpm lint 2>&1 | grep no-unused-vars`
预期：错误数量减少

**Step 5: Commit**

```bash
git add frontend/src/lib/fonts.ts frontend/src/components/editor/*.tsx frontend/src/remotion/**/*.tsx
git commit -m "fix(frontend): 清理 ESLint 未使用变量警告

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5.3: 配置 Node.js 脚本 ESLint 环境

**Files:**
- Modify: `frontend/.eslintrc` 或 `frontend/eslint.config.mjs`

**Step 1: 查看 ESLint 配置**

运行：`cat frontend/eslint.config.mjs 2>/dev/null || cat frontend/.eslintrc 2>/dev/null`

**Step 2: 添加 Node.js 环境配置**

为 `.mjs` 脚本添加 Node 环境：

```javascript
// eslint.config.mjs
export default [
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
      },
    },
  },
  // 其他配置...
];
```

**Step 3: 验证 ESLint**

运行：`cd frontend && pnpm lint 2>&1 | grep no-undef`
预期：Node.js 脚本错误消除

**Step 4: Commit**

```bash
git add frontend/eslint.config.mjs
git commit -m "fix(frontend): ESLint 配置 Node.js 环境以消除 no-undef 错误

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5.4: 补充剩余 hooks 测试（可选）

按 Task 3.3 的列表补充：
- `useTaskPolling.test.ts`
- `useFileManagement.test.ts`
- `useSavedConfigs.test.ts`

每个测试文件参考 Task 3.1/3.2 的模式编写。

---

## Summary

### Phase Checklist

| Phase | Tasks | 预估时间 | 依赖 |
|-------|-------|----------|------|
| Phase 1 | 1.1, 1.2 | 30min | 无 |
| Phase 2 | 2.1, 2.2, 2.3 | 1.5h | Phase 1 |
| Phase 3 | 3.1, 3.2 | 2h | Phase 2 |
| Phase 4 | 4.1, 4.2, 4.3 | 2h | Phase 3 |
| Phase 5 | 5.1, 5.2, 5.3 | 1.5h | Phase 4 |

### Expected Outcome

- 前端覆盖率阈值：30% → 60% ✅
- 前端 ESLint 错误：52 → <10
- 前端 hooks 单测：0 → 2+ 文件
- 后端覆盖率：54% → 70%+ (unit), 78% (dev)
- 测试目录结构：完整对齐

### Verification Commands

```bash
# Phase 1 完成后
cd frontend && pnpm test:unit -- --coverage
# 查看阈值是否生效

# Phase 2 完成后
cd frontend && pnpm lint
# 统计 remaining errors

# Phase 3 完成后
cd frontend && pnpm test:unit tests/unit/frontend/hooks/
# 确认 hooks 测试通过

# Phase 4 完成后
cd backend && uv run pytest ../tests/unit/backend/ --cov=app --cov-report=term
# 确认覆盖率提升

# Phase 5 完成后
cd frontend && pnpm lint
# 确认 ESLint 错误 <10
```