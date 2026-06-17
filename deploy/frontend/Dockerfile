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

# Copy package files and npm config first
COPY package.json pnpm-lock.yaml .npmrc ./

# Install pnpm globally
RUN npm install -g pnpm

# Install dependencies (npmrc configures hoisting)
RUN pnpm install --frozen-lockfile

# Copy source code (exclude node_modules via .dockerignore)
COPY . .

# Development server runs on port 3000
EXPOSE 3000

# Run Next.js development server
CMD ["pnpm", "dev"]

# ============================================
# Stage 3: Builder (build production artifacts)
# ============================================
FROM base AS builder

# Configure npm mirror for China
RUN npm config set registry https://registry.npmmirror.com

# Copy package files (.npmrc configures hoisting for self-contained node_modules)
COPY package.json pnpm-lock.yaml .npmrc ./

# Install pnpm globally (more reliable than corepack on Alpine)
RUN npm install -g pnpm

# Install dependencies for build
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

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
COPY package.json pnpm-lock.yaml .npmrc ./

# Install pnpm globally (more reliable than corepack on Alpine)
RUN npm install -g pnpm

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --from=builder --chown=appuser:appgroup /app/.next ./app/.next
COPY --from=builder --chown=appuser:appgroup /app/public ./app/public
COPY --from=builder --chown=appuser:appgroup /app/src/remotion ./app/src/remotion

# Create output directory for renders
RUN mkdir -p /app/output && chown -R appuser:appgroup /app/output

# Switch to non-root user
USER appuser

# Production server runs on port 3000
EXPOSE 3000

# Run Next.js production server
CMD ["pnpm", "start"]