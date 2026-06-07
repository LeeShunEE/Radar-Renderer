import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock @remotion/player 以避免在测试环境中加载 Remotion 运行时。
// 使用简单 mock 而非 JSX（setup.ts 不支持 JSX）
vi.mock("@remotion/player", () => ({
  Player: vi.fn(() => null),
}));