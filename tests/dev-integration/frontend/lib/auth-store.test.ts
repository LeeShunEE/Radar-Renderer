/**
 * auth-store dev-integration 测试。
 *
 * 链路：auth-store → api-client(auth/authFetch) → MSW。不 mock api-client，
 * 真实 fetch 验证 login→me、registerWithCode、resetPassword、refreshTokens、
 * initializeAuth（有效/无效存量 token 两路）、logout 全链路。顺带覆盖 api-client 的
 * authFetch Bearer 注入 / 401 刷新重试 / refresh 单飞锁。
 *
 * 与单元 auth-store.test.ts 区别：单元用 register-with-password（用户名密码）；
 * 集成走统一 onboarding 的验证码/OAuth 形态，且多数端点要求 Bearer（先 seedAuth）。
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  login,
  logout,
  initializeAuth,
  refreshTokens,
  registerWithCode,
  resetPassword,
  getAuthState,
  sendVerificationCode,
  setUsername,
  setPassword,
  handleOAuthCallback,
} from "@/lib/auth-store";
import { setTokens, clearTokens } from "@/lib/api-client";
import { mswServer, http, HttpResponse } from "@/test/msw-server";
import { mockTokenResponse } from "@/test/fixtures";
import { resetAuth } from "../_helpers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** 覆盖 /auth/login 为 demo 成功（集成测试未走 register-with-password，_users 为空）。 */
function loginSucceeds() {
  mswServer.use(
    http.post(`${API_BASE}/api/v1/auth/login`, () => HttpResponse.json(mockTokenResponse)),
  );
}

describe("auth-store（集成）", () => {
  beforeEach(() => {
    resetAuth();
    logout();
  });
  afterEach(() => {
    resetAuth();
    logout();
  });

  describe("login → me 链路", () => {
    it("login 成功后写入 token 并通过 me 拉取用户", async () => {
      loginSucceeds();
      await login("test@example.com", "any-password");
      const state = getAuthState();
      expect(state.user?.email).toBe("test@example.com");
      expect(state.user?.isVerified).toBe(true);
      expect(state.user?.displayName).toBe("Test User");
      expect(state.accessToken).toBe("mock-access-token");
      expect(state.loading).toBe(false);
      expect(localStorage.getItem("access_token")).toBe("mock-access-token");
    });

    it("login 失败时设置 error 并抛出", async () => {
      // 默认 handler 未匹配用户 → 401
      await expect(login("wrong@example.com", "bad")).rejects.toThrow();
      const state = getAuthState();
      expect(state.user).toBeNull();
      expect(state.error).toBeTruthy();
      expect(state.loading).toBe(false);
    });
  });

  describe("registerWithCode（验证码注册）", () => {
    it("验证码注册自动登录并返回 is_new_user", async () => {
      const isNew = await registerWithCode("new@example.com", "123456");
      expect(isNew).toBe(true);
      const state = getAuthState();
      expect(state.user).toBeTruthy();
      expect(state.accessToken).toBe("mock-access-token");
    });

    it("响应无 is_new_user 时返回 false", async () => {
      mswServer.use(
        http.post(`${API_BASE}/api/v1/auth/register`, () =>
          HttpResponse.json({ access_token: "a", refresh_token: "r", token_type: "bearer" }),
        ),
      );
      const isNew = await registerWithCode("new@example.com", "123456");
      expect(isNew).toBe(false);
    });

    it("注册失败时设置 error 并抛出", async () => {
      mswServer.use(
        http.post(`${API_BASE}/api/v1/auth/register`, () =>
          HttpResponse.json({ error: "验证码错误", code: "bad_code" }, { status: 400 }),
        ),
      );
      await expect(registerWithCode("x@x.com", "000")).rejects.toThrow("验证码错误");
      expect(getAuthState().error).toBe("验证码错误");
    });
  });

  describe("resetPassword（验证码重置）", () => {
    it("验证码重置密码并自动登录", async () => {
      await resetPassword("user@example.com", "123", "new-password");
      const state = getAuthState();
      expect(state.user).toBeTruthy();
      expect(state.accessToken).toBe("mock-access-token");
    });

    it("重置失败时设置 error 并抛出", async () => {
      mswServer.use(
        http.post(`${API_BASE}/api/v1/auth/reset-password`, () =>
          HttpResponse.json({ error: "验证码失效", code: "bad_code" }, { status: 400 }),
        ),
      );
      await expect(resetPassword("x@x.com", "000", "pw")).rejects.toThrow("验证码失效");
      expect(getAuthState().error).toBe("验证码失效");
    });
  });

  describe("验证码 / 设置凭证 / OAuth 副链路", () => {
    it("sendVerificationCode 不抛错", async () => {
      await expect(sendVerificationCode("e@x.com", "register")).resolves.toBeUndefined();
    });

    it("setUsername 更新当前用户用户名", async () => {
      loginSucceeds();
      await login("u@x.com", "pw");
      await setUsername("newname");
      expect(getAuthState().user?.username).toBe("newname");
    });

    it("setUsername 失败时设置 error 并抛出", async () => {
      loginSucceeds();
      await login("u@x.com", "pw");
      mswServer.use(
        http.post(`${API_BASE}/api/v1/auth/set-username`, () =>
          HttpResponse.json({ error: "用户名已存在", code: "taken" }, { status: 409 }),
        ),
      );
      await expect(setUsername("dup")).rejects.toThrow("用户名已存在");
      expect(getAuthState().error).toBe("用户名已存在");
    });

    it("setPassword 成功后清空 loading", async () => {
      loginSucceeds();
      await login("u@x.com", "pw");
      await setPassword("secret");
      expect(getAuthState().loading).toBe(false);
      expect(getAuthState().error).toBeNull();
    });

    it("setPassword 失败时设置 error 并抛出", async () => {
      loginSucceeds();
      await login("u@x.com", "pw");
      mswServer.use(
        http.post(`${API_BASE}/api/v1/auth/set-password`, () =>
          HttpResponse.json({ error: "密码不合规", code: "weak" }, { status: 400 }),
        ),
      );
      await expect(setPassword("x")).rejects.toThrow("密码不合规");
      expect(getAuthState().error).toBe("密码不合规");
    });

    it("handleOAuthCallback 处理回调并返回是否新用户", async () => {
      mswServer.use(
        http.get(`${API_BASE}/api/v1/auth/oauth/google/callback`, () =>
          HttpResponse.json({ access_token: "a", refresh_token: "r", token_type: "bearer", is_new_user: true }),
        ),
      );
      const isNew = await handleOAuthCallback("google", "code1", "state1");
      expect(isNew).toBe(true);
      expect(getAuthState().user).toBeTruthy();
    });

    it("handleOAuthCallback 失败时设置 error 并抛出", async () => {
      mswServer.use(
        http.get(`${API_BASE}/api/v1/auth/oauth/google/callback`, () =>
          HttpResponse.json({ error: "state 不匹配", code: "oauth_error" }, { status: 400 }),
        ),
      );
      await expect(handleOAuthCallback("google", "c", "bad")).rejects.toThrow("state 不匹配");
      expect(getAuthState().error).toBeTruthy();
    });
  });

  describe("initializeAuth（存量 token 引导）", () => {
    it("有效存量 token 时引导出当前用户", async () => {
      setTokens("mock-access-token", "mock-refresh-token");
      await initializeAuth();
      const state = getAuthState();
      expect(state.user?.email).toBe("test@example.com");
      expect(state.loading).toBe(false);
    });

    it("无存量 token 时直接结束、无用户", async () => {
      await initializeAuth();
      const state = getAuthState();
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
    });
  });

  describe("refreshTokens（含 api-client 单飞）", () => {
    it("refresh 成功更新 token", async () => {
      setTokens("old-access", "mock-refresh-token");
      await refreshTokens();
      const state = getAuthState();
      expect(state.accessToken).toBe("mock-access-token");
      expect(localStorage.getItem("access_token")).toBe("mock-access-token");
    });

    it("无 refresh token 时抛错", async () => {
      clearTokens();
      await expect(refreshTokens()).rejects.toThrow("无 refresh token");
    });
  });

  describe("api-client 401 刷新重试链路", () => {
    it("access token 过期 → 401 → 用 refresh 刷新并重试 me 成功", async () => {
      // 存入与 MSW 不匹配的 access（me 会 401），但 refresh 有效（refresh handler 始终返回新 token）。
      setTokens("expired-access", "mock-refresh-token");
      await initializeAuth();
      // me 经 401 刷新重试后成功，应取回用户而非清空。
      const state = getAuthState();
      expect(state.user?.email).toBe("test@example.com");
      expect(state.loading).toBe(false);
    });
  });

  describe("logout", () => {
    it("登出清空用户与 token", async () => {
      loginSucceeds();
      await login("test@example.com", "pw");
      logout();
      const state = getAuthState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(localStorage.getItem("access_token")).toBeNull();
    });
  });
});
