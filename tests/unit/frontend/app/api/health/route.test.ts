/**
 * GET /api/health 契约测试：保护「200 + { status: 'ok' }」返回不被改坏。
 * 参照 tests/unit/frontend/lib/rating.test.ts 的风格（@/ alias 由 vitest.config.ts 解析）。
 */
import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns 200 with { status: 'ok' }", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
