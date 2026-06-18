import { NextResponse } from "next/server";

/**
 * 轻量健康探针：供 Docker healthcheck / Coolify 探活。
 * 故意不依赖 DB / 后端，只反映「本 Next.js 进程是否在响应」，
 * 与 backend 的 /api/v1/health、render-worker 的 /health 语义一致。
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
