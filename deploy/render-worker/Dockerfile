# Render Worker Dockerfile for radar-chart-rendering
# Remotion-based video rendering worker (HTTP service on port 3100)

# ============================================
# Stage 1: Base image with Node.js and Chromium
# ============================================
FROM node:20-alpine AS base

# Install Chromium for Remotion rendering
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

# Copy source code (including remotion components)
COPY . .

# Development server runs on port 3100
EXPOSE 3100

# Run render worker
CMD ["pnpm", "worker"]

# ============================================
# Stage 3: Builder (prepare for production)
# ============================================
FROM base AS builder

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies for Remotion bundler
RUN pnpm install --frozen-lockfile

# Copy source code (remotion components are needed for bundling)
COPY src/remotion ./src/remotion
COPY public ./public
COPY tsconfig.json ./
COPY package.json ./

# ============================================
# Stage 4: Production (minimal worker)
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
ENV WORKER_PORT=3100

# Create non-root user for security
RUN addgroup --gid 1000 --system appgroup \
    && adduser --uid 1000 --system --ingroup appgroup --shell /bin/sh appuser

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install only production dependencies (need Remotion packages)
RUN pnpm install --frozen-lockfile --prod

# Copy render worker server
COPY --chown=appuser:appgroup render-worker/server.mjs ./render-worker/server.mjs

# Copy source code needed for Remotion bundling
COPY --from=builder --chown=appuser:appgroup /app/src/remotion ./src/remotion
COPY --from=builder --chown=appuser:appgroup /app/public ./public
COPY --from=builder --chown=appuser:appgroup /app/tsconfig.json ./

# Create output directory
RUN mkdir -p /app/output && chown -R appuser:appgroup /app/output

# Switch to non-root user
USER appuser

# Production server runs on port 3100
EXPOSE 3100

# Run render worker
CMD ["node", "render-worker/server.mjs"]