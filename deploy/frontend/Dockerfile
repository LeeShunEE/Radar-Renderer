# Frontend Dockerfile for radar-chart-rendering (Next.js + Remotion)
# Multi-stage build: development -> builder -> production

# ============================================
# Stage 1: Base image with Node.js and Chromium
# ============================================
FROM node:20-alpine AS base

# Configure Alpine mirror for China
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# Install Chromium for Remotion rendering
# Remotion requires a browser for video rendering
RUN apk add --no-cache \
    chromium \
    chromium-chromedriver \
    ffmpeg \
    fontconfig \
    font-noto \
    font-noto-cjk \
    && rm -rf /var/cache/apk/*

# Set Chromium path for Remotion
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Set working directory
WORKDIR /app

# ============================================
# Stage 2: Development stage
# ============================================
FROM base AS development

# Configure npm mirror for China
RUN npm config set registry https://registry.npmmirror.com

# Copy package files and npm config first（context=仓库根，源在 frontend/ 子树）
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/.npmrc ./

# Install pnpm globally
RUN npm install -g pnpm

# Install dependencies (npmrc configures hoisting)
RUN pnpm install --frozen-lockfile

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

# Configure npm mirror for China
RUN npm config set registry https://registry.npmmirror.com

# Copy package files (.npmrc configures hoisting for self-contained node_modules)
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/.npmrc ./

# Install pnpm globally (more reliable than corepack on Alpine)
RUN npm install -g pnpm

# Install dependencies for build
RUN pnpm install --frozen-lockfile

# Copy source code（context=仓库根，源在 frontend/ 子树）
COPY frontend/ ./

# 装 git 并拷 .git：next.config.js 用 git describe 生成版本号注入 NEXT_PUBLIC_APP_VERSION。
# 仅 builder 阶段，产物经 --from=builder 精挑 COPY，.git 不进最终镜像。
RUN apk add --no-cache git
COPY .git ./.git

# Set NEXT_PUBLIC_API_URL as ENV for Next.js build to embed into client code
# This must happen BEFORE pnpm build
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build Next.js application
RUN pnpm build

# ============================================
# Stage 4: Production (minimal, standalone)
# ============================================
FROM node:20-alpine AS production

# Configure Alpine mirror for China
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# Install minimal runtime dependencies for Remotion
RUN apk add --no-cache \
    chromium \
    ffmpeg \
    fontconfig \
    font-noto \
    font-noto-cjk \
    && rm -rf /var/cache/apk/*

# Configure npm mirror for China
RUN npm config set registry https://registry.npmmirror.com

# Set Chromium path for Remotion
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
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
RUN npm install -g pnpm

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

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