/**
 * AuthContext 单元测试：mock auth-store，验证 Provider 订阅/透传/useAuth 边界。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const store = vi.hoisted(() => ({
  state: { user: null as null | { username: string }, loading: true, error: null as string | null },
  subCb: null as null | ((s: unknown) => void),
}));

vi.mock("@/lib/auth-store", () => ({
  getAuthState: () => store.state,
  subscribe: (cb: (s: unknown) => void) => {
    store.subCb = cb;
    return () => {
      store.subCb = null;
    };
  },
  initializeAuth: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshTokens: vi.fn(),
}));

// 消费 useAuth 的探针组件
function Probe() {
  const { user, loading, isAuthenticated } = useAuth();
  return (
    <div data-testid="probe">
      {user ? user.username : "none"}|{loading ? "loading" : "ready"}|{isAuthenticated ? "auth" : "anon"}
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    store.state = { user: null, loading: true, error: null };
    store.subCb = null;
    vi.clearAllMocks();
  });

  it("AuthProvider 挂载时订阅并初始化，透出初始 state", () => {
    store.state = { user: null, loading: false, error: null };
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId("probe").textContent).toBe("none|ready|anon");
  });

  it("auth-store 通知后 context 值更新", () => {
    store.state = { user: null, loading: true, error: null };
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    act(() => {
      store.subCb?.({ user: { username: "alice" }, loading: false, error: null });
    });

    expect(screen.getByTestId("probe").textContent).toBe("alice|ready|auth");
  });

  it("卸载时取消订阅", () => {
    store.state = { user: null, loading: false, error: null };
    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(store.subCb).not.toBeNull();
    unmount();
    expect(store.subCb).toBeNull();
  });

  it("useAuth 在无 Provider 时抛错", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow("useAuth must be used within AuthProvider");
    spy.mockRestore();
  });
});
