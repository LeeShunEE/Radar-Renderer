#!/bin/bash
# 环境初始化脚本

echo "Initializing development environment..."

# 前端
cd frontend
pnpm install

# 后端
cd backend
uv pip install -e ".[test,dev]"

echo "Environment initialized successfully!"