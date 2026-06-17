# Frontend Dockerfile for radar-chart-rendering (Next.js + Remotion)
# Multi-stage build: development -> builder -> production

# ============================================
# Stage 1: Base image with Node.js and Chromium
# ============================================
FROM node:20-alpine AS base

# Install Chromium for Remotion rendering
# Remotion requires a browser for video rendering
RUN apk add --no-cache \
    chromium \
    chromium-chromedriver \
    ffmpeg \
    fontconfig \
    fonts-liberation \
    fonts-noto-cjk \
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

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Development server runs on port 3000
EXPOSE 3000

# Run Next.js development server
CMD ["pnpm", "dev"]

# ============================================
# Stage 3: Builder (build production artifacts)
# ============================================
FROM base AS builder

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

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

# Install minimal runtime dependencies for Remotion
RUN apk add --no-cache \
    chromium \
    ffmpeg \
    fontconfig \
    fonts-liberation \
    fonts-noto-cjk \
    && rm -rf /var/cache/apk/*

# Set Chromium path for Remotion
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --gid 1000 --system appgroup \
    && adduser --uid 1000 --system --ingroup appgroup --shell /bin/sh appuser

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

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