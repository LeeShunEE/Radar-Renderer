/**
 * next/navigation 的测试替身（通过 vitest alias 注入）。
 *
 * 单元测试不挂载 Next App Router，useRouter 真实实现会抛
 * "invariant expected app router to be mounted"。此替身提供可重置的 router。
 */
import { vi } from "vitest";

export const __router = {
  push: vi.fn(),
  replace: vi.fn(),
};

export function useRouter() {
  return __router;
}

export function useSearchParams() {
  return new URLSearchParams();
}
