/**
 * utils.ts 单元测试：cn 合并 Tailwind 类。
 */
import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges classes", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("dedupes conflicting tailwind classes", () => {
    // twMerge dedupes: later wins
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
  it("handles falsy inputs", () => {
    expect(cn("a", false && "b", null, undefined)).toBe("a");
  });
});