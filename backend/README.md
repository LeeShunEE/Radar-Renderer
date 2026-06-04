# Radar Chart Backend

FastAPI 后端服务。

## 快速开始

```bash
# 安装依赖
uv pip install -e ".[test,dev]"

# 启动服务
uv run uvicorn app.main:app --reload

# 运行测试
uv run pytest ../tests/unit/backend/ -v
```

## 目录结构

- `app/api/` - API 路由
- `app/core/` - 核心配置
- `app/models/` - ORM 模型
- `app/schemas/` - Pydantic schemas
- `app/service/` - 业务服务
- `app/dao/` - 数据访问
- `app/utils/` - 工具函数