# Backend Dockerfile for radar-chart-rendering
# Multi-stage build: development -> production

# ============================================
# Stage 1: Base image with uv installer
# ============================================
FROM python:3.11-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
COPY --from=ghcr.io/astralsh/uv:latest /uv /uvx /bin/

# Set working directory
WORKDIR /app

# ============================================
# Stage 2: Development stage (with dev tools)
# ============================================
FROM base AS development

# Copy dependency files
COPY pyproject.toml .

# Install all dependencies (including dev/test extras)
RUN uv pip install --system -e ".[test,dev]"

# Copy source code and alembic
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

# Development server runs on port 8000
EXPOSE 8000

# Run uvicorn with reload for development
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ============================================
# Stage 3: Builder (prepare production artifacts)
# ============================================
FROM base AS builder

# Copy dependency files
COPY pyproject.toml .

# Install production dependencies only
RUN uv pip install --system -e "."

# Copy source code and alembic
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

# ============================================
# Stage 4: Production (minimal, non-root)
# ============================================
FROM python:3.11-slim AS production

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd --gid 1000 appgroup \
    && useradd --uid 1000 --gid appgroup --shell /bin/bash --create-home appuser

# Set working directory
WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy source code and alembic from builder
COPY --from=builder --chown=appuser:appgroup /app/app ./app
COPY --from=builder --chown=appuser:appgroup /app/alembic ./alembic
COPY --from=builder --chown=appuser:appgroup /app/alembic.ini .

# Create storage directory for uploads/outputs
RUN mkdir -p /app/storage && chown -R appuser:appgroup /app/storage

# Switch to non-root user
USER appuser

# Production server runs on port 8000
EXPOSE 8000

# Copy entrypoint script
COPY --chown=appuser:appgroup deploy/backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Run entrypoint script (handles migrations before startup)
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]