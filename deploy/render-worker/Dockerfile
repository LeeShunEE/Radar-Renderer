# Render Worker Dockerfile for radar-chart-rendering
# Remotion-based video rendering worker (HTTP service on port 3100)

# ============================================
# Stage 1: Base image with Node.js and Chromium
# ============================================
FROM node:20-alpine AS base

# Configure Alpine mirror for China
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# Install Chromium for Remotion rendering.
# setpriv: Remotion launches Chromium via `setpriv --pdeathsig`; BusyBox's setpriv
# lacks that flag, so install the real util-linux setpriv (lands in /usr/bin, ahead
# of BusyBox /bin in PATH).
RUN apk add --no-cache \
    chromium \
    chromium-chromedriver \
    ffmpeg \
    fontconfig \
    font-noto \
    font-noto-cjk \
    setpriv \
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

# Copy package files (.npmrc configures hoisting for self-contained node_modules)
COPY package.json pnpm-lock.yaml .npmrc ./

# Install pnpm globally (more reliable than corepack on Alpine)
RUN npm install -g pnpm

# Install all dependencies (approve builds for native packages)
RUN pnpm install --frozen-lockfile && pnpm approve-builds

# Copy source code (including remotion components).
# 不要用 COPY . .：会把宿主机 Windows pnpm 创建的绝对路径 symlink 死链
# (frontend/node_modules/.pnpm/.../node_modules/@remotion/bundler -> C:/Users/...)
# 盖进容器，顶替上方 pnpm install 生成的扁平真实产物，导致 ESM 解析崩溃 + restart 循环。
# 显式 COPY 仅源码目录，node_modules 完全由容器内 pnpm install 生成。
COPY src ./src
COPY styles ./styles
COPY public ./public
COPY render-worker ./render-worker
COPY tsconfig.json ./
COPY package.json ./

# Development server runs on port 3100
EXPOSE 3100

# Run render worker
CMD ["pnpm", "worker"]

# ============================================
# Stage 3: Builder (prepare for production)
# ============================================
FROM base AS builder

# Configure npm mirror for China
RUN npm config set registry https://registry.npmmirror.com

# Copy package files (.npmrc configures hoisting for self-contained node_modules)
COPY package.json pnpm-lock.yaml .npmrc ./

# Install pnpm globally (more reliable than corepack on Alpine)
RUN npm install -g pnpm

# Install dependencies for Remotion bundler
RUN pnpm install --frozen-lockfile

# Copy source code for bundling.
# The whole src/ is needed: remotion components import from src/lib/* and
# src/types/* (and tsconfig "@/*" path alias resolves to ./src/*).
COPY src ./src
COPY styles ./styles
COPY public ./public
COPY tsconfig.json ./
COPY package.json ./

# ============================================
# Stage 4: Production (minimal worker)
# ============================================
FROM node:20-alpine AS production

# Configure Alpine mirror for China
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# Install minimal runtime dependencies for Remotion.
# setpriv: needed for Chromium launch (BusyBox setpriv lacks --pdeathsig).
RUN apk add --no-cache \
    chromium \
    ffmpeg \
    fontconfig \
    font-noto \
    font-noto-cjk \
    setpriv \
    && rm -rf /var/cache/apk/*

# Configure npm mirror for China
RUN npm config set registry https://registry.npmmirror.com

# Set Chromium path for Remotion
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production
ENV WORKER_PORT=3100

# Create non-root user for security
# Let Alpine pick free IDs: node:20-alpine already ships a user at uid/gid 1000.
RUN addgroup --system appgroup \
    && adduser --system --ingroup appgroup --shell /bin/sh appuser

# Set working directory
WORKDIR /app

# Copy package files (.npmrc configures hoisting for self-contained node_modules)
COPY package.json pnpm-lock.yaml .npmrc ./

# Install pnpm globally (more reliable than corepack on Alpine)
RUN npm install -g pnpm

# Install only production dependencies (need Remotion packages)
RUN pnpm install --frozen-lockfile --prod

# Copy render worker server
COPY --chown=appuser:appgroup render-worker/server.mjs ./render-worker/server.mjs

# Copy source code needed for Remotion bundling (whole src/: components pull in
# src/lib/* and src/types/*, and tsconfig "@/*" alias resolves to ./src/*).
COPY --from=builder --chown=appuser:appgroup /app/src ./src
COPY --from=builder --chown=appuser:appgroup /app/styles ./styles
COPY --from=builder --chown=appuser:appgroup /app/public ./public
COPY --from=builder --chown=appuser:appgroup /app/tsconfig.json ./

# Create output directory, plus a writable webpack cache dir (node_modules is
# root-owned; without this appuser hits EACCES on /app/node_modules/.cache and
# bundling can't be cached across renders).
RUN mkdir -p /app/output /app/node_modules/.cache \
    && chown -R appuser:appgroup /app/output /app/node_modules/.cache

# Switch to non-root user
USER appuser

# Production server runs on port 3100
EXPOSE 3100

# Run render worker
CMD ["node", "render-worker/server.mjs"]