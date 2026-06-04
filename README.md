# Radar Chart Rendering

视频雷达图渲染工具，支持多模型对比可视化。

## 目录结构

- `frontend/` - Next.js + Remotion 前端
- `backend/` - FastAPI 后端（开发中）
- `tests/` - 统一测试目录
- `scripts/` - 工具脚本

## 快速开始

### 前端

```bash
cd frontend
pnpm install
pnpm dev
```

### 后端

```bash
cd backend
uv pip install -e ".[test,dev]"
uv run uvicorn app.main:app --reload
```

## 测试

```bash
# 后端测试
cd backend && uv run pytest ../tests/unit/backend/ -v

# 前端测试
cd frontend && pnpm test:unit
```

## 资源文件

`frontend/public/silhouettes/` 和 `frontend/public/music/` 目录中的资源文件不 commit 到仓库。
请手动添加所需资源文件到对应目录。