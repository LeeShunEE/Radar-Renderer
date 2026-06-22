# syntax=docker/dockerfile:1.7
# Frontend Dockerfile for radar-chart-rendering (Next.js + Remotion)
# Multi-stage build: development -> builder -> production

# Mirror ARGs default to empty = official sources. Coolify (overseas) passes
# nothing and hits the global CDNs (fastest); local China dev passes the mirrors
# via docker-compose.dev.yml build.args. ARGs do NOT cross stage boundaries, so
# each stage that needs one redeclares it.

# ============================================
# Stage 1: Base image with Node.js and Chromium
# ============================================
FROM node:20-alpine AS base

ARG ALPINE_MIRROR=

# Apply Alpine mirror only when provided; empty keeps the default global CDN.
RUN if [ -n "$ALPINE_MIRROR" ]; then \
      sed -i "s|dl-cdn.alpinelinux.org|$ALPINE_MIRROR|g" /etc/apk/repositories; \
    fi

# Install Chromium for Remotion rendering.
# Remotion requires a browser for video rendering (dev preview + builder stage).
# Cache mount reuses the apk package cache (~300MB chromium) across rebuilds
# instead of re-downloading every time; the cache lives in BuildKit's mount,
# never in the image layer, so images stay small.
RUN --mount=type=cache,target=/var/cache/apk \
    apk add \
    chromium \
    chromium-chromedriver \
    ffmpeg \
    fontconfig \
    font-noto \
    font-noto-cjk

# Set Chromium path for Remotion
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Set working directory
WORKDIR /app

# ============================================
# Stage 2: Development stage
# ============================================
FROM base AS development

ARG NPM_REGISTRY=

# Apply npm mirror only when provided; empty keeps the default registry.
RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi

# Copy package files and npm config first（context=仓库根，源在 frontend/ 子树）
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/.npmrc ./

# Install pnpm globally (cache mount reuses npm's download cache across rebuilds)
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm

# Install dependencies (npmrc configures hoisting). Cache mount on pnpm's
# content-addressable store avoids re-fetching packages across rebuilds.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source code（只拷 frontend 子树，根 context 下不 COPY 整个仓库）
COPY frontend/ ./

# Development server runs on port 3000
EXPOSE 3000

# Run Next.js development server
CMD ["pnpm", "dev"]

# ============================================
# Stage 3: Builder (build production artifacts)
# ============================================
FROM base AS builder

# ARG declarations for Coolify compatibility
# NEXT_PUBLIC_API_URL is needed at build time for Next.js client-side code
ARG NEXT_PUBLIC_API_URL
ARG NPM_REGISTRY=

# Apply npm mirror only when provided; empty keeps the default registry.
RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi

# Copy package files (.npmrc configures hoisting for self-contained node_modules)
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/.npmrc ./

# Install pnpm globally (more reliable than corepack on Alpine)
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm

# Install dependencies for build
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source code（context=仓库根，源在 frontend/ 子树）
COPY frontend/ ./

# Set NEXT_PUBLIC_API_URL as ENV for Next.js build to embed into client code
# This must happen BEFORE pnpm build
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# 版本号经 build ARG 注入（容器构建上下文无 .git，跑不了 git describe）。
# Coolify 自动提供 SOURCE_COMMIT；next.config.js 拼 package.json 版本 + 短 sha。
ARG SOURCE_COMMIT=
ENV SOURCE_COMMIT=${SOURCE_COMMIT}

# Build Next.js application
RUN pnpm build

# ============================================
# Stage 4: Production (minimal, no browser)
# ============================================
# 生产只跑 `next start`，不渲染视频（渲染全在 render-worker，
# frontend/src 无 @remotion/renderer/chromium/puppeteer 引用），
# 故不装 chromium/ffmpeg/字体 —— 生产镜像大幅瘦身。
FROM node:20-alpine AS production

ARG NPM_REGISTRY=

# Apply npm mirror only when provided; empty keeps the default registry.
RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi

ENV NODE_ENV=production

# Create non-root user for security
# Let Alpine pick free IDs: node:20-alpine already ships a user at uid/gid 1000.
RUN addgroup --system appgroup \
    && adduser --system --ingroup appgroup --shell /bin/sh appuser

# Set working directory
WORKDIR /app

# Copy package files (.npmrc configures hoisting for self-contained node_modules)
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/.npmrc ./

# Install pnpm globally (more reliable than corepack on Alpine)
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm

# Install only production dependencies
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --from=builder --chown=appuser:appgroup /app/.next ./.next
COPY --from=builder --chown=appuser:appgroup /app/public ./public
COPY --from=builder --chown=appuser:appgroup /app/src/remotion ./src/remotion

# Create output directory for renders
RUN mkdir -p /app/output && chown -R appuser:appgroup /app/output

# Switch to non-root user
USER appuser

# Production server runs on port 3000
EXPOSE 3000

# Run Next.js production server
CMD ["pnpm", "start"]
