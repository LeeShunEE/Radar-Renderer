/**
 * AuthContext dev-integration 测试。
 *
 * 链路：AuthProvider → auth-store → api-client → MSW。render 真实 Provider + 消费者，
 * 验证 bootstrap（initializeAuth）、login→user 出现、logout→清空 全链路。
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { logout, getAuthState } from "@/lib/auth-store";
import { mswServer, http, HttpResponse } from "@/test/msw-server";
import { mockTokenResponse } from "@/test/fixtures";
import { resetAuth } from "../_helpers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** 消费者：把 useAuth 暴露到 DOM 便于断言。 */
function Consumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="user">{auth.user ? auth.user.email : "无用户"}</span>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="authed">{String(auth.isAuthenticated)}</span>
    </div>
  );
}

describe("AuthContext（集成）", () => {
  beforeEach(() => {
    resetAuth();
    logout();
  });
  afterEach(() => {
    resetAuth();
    logout();
  });

  it("无存量 token 时 bootstrap 结束于未登录态", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("无用户");
    expect(screen.getByTestId("authed").textContent).toBe("false");
  });

  it("有效存量 token 时 bootstrap 拉取到用户", async () => {
    localStorage.setItem("access_token", "mock-access-token");
    localStorage.setItem("refresh_token", "mock-refresh-token");

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("test@example.com");
    });
    expect(screen.getByTestId("authed").textContent).toBe("true");
  });

  it("login 成功后消费者出现用户并标记已登录", async () => {
    function LoginConsumer() {
      const auth = useAuth();
      return (
        <div>
          <span data-testid="user">{auth.user ? auth.user.email : "无用户"}</span>
          <button
            data-testid="login"
            onClick={() => {
              void auth.login("test@example.com", "pw");
            }}
          >
            登录
          </button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <LoginConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("无用户"));

    // 覆盖 /auth/login 为 demo 成功（_users 为空，默认 handler 会 401）
    mswServer.use(
      http.post(`${API_BASE}/api/v1/auth/login`, () => HttpResponse.json(mockTokenResponse)),
    );

    await act(async () => {
      screen.getByTestId("login").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("test@example.com");
    });
    expect(getAuthState().accessToken).toBe("mock-access-token");
  });

  it("logout 后消费者回到未登录态", async () => {
    function LogoutConsumer() {
      const auth = useAuth();
      return (
        <div>
          <span data-testid="user">{auth.user ? auth.user.email : "无用户"}</span>
          <button
            data-testid="logout"
            onClick={() => {
              void auth.logout();
            }}
          >
            登出
          </button>
        </div>
      );
    }

    // 先用 token bootstrap 到登录态
    localStorage.setItem("access_token", "mock-access-token");
    localStorage.setItem("refresh_token", "mock-refresh-token");
    render(
      <AuthProvider>
        <LogoutConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("test@example.com"));

    await act(async () => {
      screen.getByTestId("logout").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("无用户");
    });
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("在无 AuthProvider 外消费 useAuth 抛错", () => {
    function BareConsumer() {
      useAuth();
      return null;
    }
    expect(() => render(<BareConsumer />)).toThrow(/AuthProvider/);
  });
});
