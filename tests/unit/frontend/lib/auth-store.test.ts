/**
 * auth-store.ts 单元测试：login/register/logout/initializeAuth + subscribe。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mswServer, resetMockState } from "@/test/msw-server";

import {
  login,
  register,
  logout,
  initializeAuth,
  refreshTokens,
  subscribe,
  getAuthState,
} from "@/lib/auth-store";
import { setTokens, clearTokens } from "@/lib/api-client";

describe("auth-store", () => {
  beforeEach(() => {
    mswServer.listen({ onUnhandledRequest: "error" });
    localStorage.clear();
    resetMockState();
    logout();
  });
  afterEach(() => {
    mswServer.resetHandlers();
    mswServer.close();
  });

  describe("register + login", () => {
    it("registers then auto-login", async () => {
      await register("testuser", "test@example.com", "password123");
      const state = getAuthState();
      expect(state.user?.username).toBe("testuser");
      expect(state.accessToken).toBeTruthy();
      expect(state.loading).toBe(false);
    });
    it("login sets user and tokens", async () => {
      // 先注册
      await register("testuser", "test@example.com", "password123");
      logout();
      // 再登录
      await login("testuser", "password123");
      const state = getAuthState();
      expect(state.user?.username).toBe("testuser");
      expect(state.accessToken).toBeTruthy();
    });
    it("login error sets error and notifies before throw", async () => {
      const states: unknown[] = [];
      const unsub = subscribe((s) => states.push(s));
      await expect(login("nonexistent", "wrong")).rejects.toThrow();
      const state = getAuthState();
      expect(state.error).toBeTruthy();
      expect(state.loading).toBe(false);
      // 关键回归：notify() 在 throw 前调用，loading 复位
      expect(states.at(-1)).toMatchObject({ loading: false });
      unsub();
    });
  });

  describe("logout", () => {
    it("clears state and tokens", async () => {
      await register("testuser", "t@example.com", "pw");
      logout();
      const state = getAuthState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(localStorage.getItem("access_token")).toBeNull();
    });
  });

  describe("initializeAuth", () => {
    it("resolves to no user when no stored tokens", async () => {
      await initializeAuth();
      const state = getAuthState();
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
    });
    it("fetches user when stored token valid", async () => {
      // 注册一个用户让 MSW me() 返回有效
      await register("testuser", "t@example.com", "pw");
      // 模拟已有 token（initializeAuth 会调用 auth.me）
      await initializeAuth();
      const state = getAuthState();
      expect(state.user).toBeTruthy();
    });
  });

  describe("refreshTokens", () => {
    it("throws when no stored refresh token", async () => {
      await expect(refreshTokens()).rejects.toThrow("无 refresh token");
    });
    it("refreshes tokens successfully", async () => {
      await register("testuser", "t@example.com", "pw");
      await refreshTokens();
      const state = getAuthState();
      expect(state.accessToken).toBeTruthy();
    });
  });

  describe("subscribe", () => {
    it("calls listener on state change", async () => {
      const calls: unknown[] = [];
      const unsub = subscribe((s) => calls.push(s.user));
      await register("testuser", "t@example.com", "pw");
      expect(calls.length).toBeGreaterThan(0);
      unsub();
    });
    it("unsubscribe stops calls", async () => {
      const calls: unknown[] = [];
      const unsub = subscribe((s) => calls.push(s));
      unsub();
      await register("testuser", "t@example.com", "pw");
      expect(calls.length).toBe(0);
    });
  });
});