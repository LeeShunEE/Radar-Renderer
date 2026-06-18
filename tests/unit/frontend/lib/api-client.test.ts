/**
 * api-client.ts 单元测试：mock fetch，验证 header 注入、401 刷新重试、错误解析。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  auth,
  files,
  render,
  tasks,
  assets,
  setTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  ApiError,
  TaskResponse,
} from "@/lib/api-client";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock });

describe("api-client", () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("token helpers", () => {
    it("setTokens writes to localStorage", () => {
      setTokens("access123", "refresh456");
      expect(localStorageMock.getItem("access_token")).toBe("access123");
      expect(localStorageMock.getItem("refresh_token")).toBe("refresh456");
    });

    it("clearTokens removes from localStorage", () => {
      setTokens("access", "refresh");
      clearTokens();
      expect(localStorageMock.getItem("access_token")).toBeNull();
      expect(localStorageMock.getItem("refresh_token")).toBeNull();
    });

    it("getAccessToken returns stored token", () => {
      localStorageMock.setItem("access_token", "stored-access");
      expect(getAccessToken()).toBe("stored-access");
    });
  });

  describe("authFetch", () => {
    it("injects Authorization header when token exists", async () => {
      setTokens("test-access", "test-refresh");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 1 }),
      });

      await auth.me();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/auth/me");
      expect(options.headers.get("Authorization")).toBe("Bearer test-access");
    });

    it("parses error response on non-2xx", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "未提供凭证", code: "auth_error" }),
      });

      await expect(auth.me()).rejects.toThrow("未提供凭证");
    });

    it("returns null for 204 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: vi.fn(),
      });

      const result = await files.delete("test.png");
      expect(result).toBeNull();
    });
  });

  describe("auth endpoints", () => {
    it("register calls correct endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 1, username: "test", email: "test@example.com", created_at: "2026-01-01" }),
      });

      const result = await auth.register("test", "test@example.com", "password123");
      expect(result.username).toBe("test");
      expect(mockFetch.mock.calls[0][0]).toContain("/api/v1/auth/register");
    });

    it("login returns tokens", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "acc", refresh_token: "ref", token_type: "bearer" }),
      });

      const result = await auth.login("test", "password");
      expect(result.access_token).toBe("acc");
      expect(result.refresh_token).toBe("ref");
    });
  });

  describe("files endpoints", () => {
    it("list returns files and quota", async () => {
      setTokens("acc", "ref");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          files: [{ name: "test.png", size_bytes: 1024, modified_at: "2026-01-01" }],
          quota: { used_bytes: 1024, limit_bytes: 200000000, available_bytes: 199998976 },
        }),
      });

      const result = await files.list();
      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe("test.png");
    });

    it("downloadUpload returns URL", () => {
      const url = files.downloadUpload("test.png");
      expect(url).toContain("/api/v1/files/uploads/test.png");
    });
  });

  describe("render endpoints", () => {
    it("submit posts to /render", async () => {
      setTokens("acc", "ref");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 1,
          mode: "single",
          codec: "h264",
          status: "queued",
          input_props: {},
          output_path: "",
          created_at: "2026-01-01",
        }),
      });

      const result = await render.submit("single", "h264", { characterName: "Test" });
      expect(result.id).toBe(1);
      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    });
  });

  describe("tasks endpoints", () => {
    it("list returns queue_size and tasks", async () => {
      setTokens("acc", "ref");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ queue_size: 2, tasks: [] }),
      });

      const result = await tasks.list();
      expect(result.queue_size).toBe(2);
    });

    it("get returns single task", async () => {
      setTokens("acc", "ref");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 1, mode: "single", codec: "h264", status: "queued", position: 0, eta_seconds: 30 }),
      });

      const result = await tasks.get(1);
      expect(result.id).toBe(1);
      expect(result.position).toBe(0);
    });
  });

  describe("assets endpoints", () => {
    it("listSilhouettes returns array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ name: "hero.png", path: "silhouettes/hero.png", size_bytes: 1024 }],
      });

      const result = await assets.listSilhouettes();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("hero.png");
    });

    it("url constructs asset URL", () => {
      const url = assets.url("silhouettes", "hero.png");
      expect(url).toContain("/api/v1/assets/silhouettes/hero.png");
    });

    it("url encodes asset name", () => {
      const url = assets.url("music", "rock & roll.mp3");
      expect(url).toContain("rock%20%26%20roll.mp3");
    });

    it("listMusic returns array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ name: "bgm.mp3", path: "music/bgm.mp3", size_bytes: 2 }],
      });

      const result = await assets.listMusic();
      expect(result[0].name).toBe("bgm.mp3");
    });
  });

  describe("authFetch 高级分支", () => {
    it("getRefreshToken 读取存储的 refresh token", () => {
      localStorageMock.setItem("refresh_token", "stored-refresh");
      expect(getRefreshToken()).toBe("stored-refresh");
    });

    it("带 body 时自动注入 Content-Type", async () => {
      setTokens("a", "r");
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

      await auth.setUsername("alice");

      const opts = mockFetch.mock.calls[0][1];
      expect(opts.headers.get("Content-Type")).toBe("application/json");
    });

    it("401 + 有效 refresh token 触发刷新并重试", async () => {
      setTokens("expired", "valid-refresh");
      mockFetch
        // 第 1 次：GET me → 401
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "expired", code: "x" }) })
        // 第 2 次：POST refresh → 200 新 token
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "new-a", refresh_token: "new-r" }) })
        // 第 3 次：GET me 重试 → 200
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 9, username: "u", email: "e", is_verified: true, display_name: null, created_at: "x" }) });

      const result = await auth.me();
      expect(result.id).toBe(9);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(getAccessToken()).toBe("new-a");
      expect(getRefreshToken()).toBe("new-r");
    });

    it("401 + 刷新失败时抛出原始错误并清空 token", async () => {
      setTokens("expired", "bad-refresh");
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "expired", code: "x" }) })
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "refresh failed" }) });

      await expect(auth.me()).rejects.toThrow("expired");
      expect(getRefreshToken()).toBeNull();
    });

    it("401 且无 refresh token 时不重试直接抛错", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "no creds", code: "auth_error" }) });

      await expect(auth.me()).rejects.toThrow("no creds");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("非 2xx 且响应体非 JSON 时使用默认错误消息", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => { throw new Error("not json"); } });

      await expect(auth.me()).rejects.toThrow("未知错误");
    });

    it("抛出的 ApiError 携带 code 与 status", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: "禁止", code: "forbidden" }) });

      try {
        await auth.me();
        expect.fail("应抛出");
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).status).toBe(403);
        expect((e as ApiError).code).toBe("forbidden");
      }
    });
  });

  describe("auth 其余端点", () => {
    const okUser = () => ({ ok: true, status: 200, json: async () => ({ id: 1, username: "u", email: "e", created_at: "x" }) });

    it("sendCode posts to /send-code", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ message: "ok" }) });
      const res = await auth.sendCode("e@x.com", "register");
      expect(res.message).toBe("ok");
      expect(mockFetch.mock.calls[0][0]).toContain("/api/v1/auth/send-code");
    });

    it("resetPassword posts to /reset-password", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "a", refresh_token: "r", token_type: "bearer" }) });
      const res = await auth.resetPassword("e@x.com", "123", "pw");
      expect(res.access_token).toBe("a");
    });

    it("registerWithPassword posts username/email/password", async () => {
      mockFetch.mockResolvedValueOnce(okUser());
      const res = await auth.registerWithPassword("u", "e@x.com", "pw");
      expect(res.username).toBe("u");
    });

    it("login 以邮箱登录时发送 email 字段", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "a", refresh_token: "r", token_type: "bearer" }) });
      await auth.login("e@x.com", "pw");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.email).toBe("e@x.com");
      expect(body.username).toBeUndefined();
    });

    it("refresh posts refresh_token", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "a", refresh_token: "r" }) });
      const res = await auth.refresh("old-r");
      expect(res.access_token).toBe("a");
    });

    it("setUsername / setPassword", async () => {
      mockFetch.mockResolvedValueOnce(okUser());
      await auth.setUsername("newname");
      mockFetch.mockResolvedValueOnce(okUser());
      await auth.setPassword("secret");
      expect(mockFetch.mock.calls[0][0]).toContain("/set-username");
      expect(mockFetch.mock.calls[1][0]).toContain("/set-password");
    });

    it("oauthProviders / oauthStart / oauthCallback", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ google: true, github: false }) });
      const providers = await auth.oauthProviders();
      expect(providers.google).toBe(true);

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ auth_url: "https://oauth/start" }) });
      const start = await auth.oauthStart("google");
      expect(start.auth_url).toContain("oauth");

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "a", refresh_token: "r", token_type: "bearer", is_new_user: true }) });
      const cb = await auth.oauthCallback("google", "code1", "state1");
      expect(cb.is_new_user).toBe(true);
      expect(mockFetch.mock.calls.at(-1)![0]).toContain("code=code1&state=state1");
    });

    it("listOAuthAccounts / bindOAuth / unbindOAuth", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 1, provider: "github", provider_email: null, provider_display_name: null, created_at: "x" }] });
      const accs = await auth.listOAuthAccounts();
      expect(accs).toHaveLength(1);

      mockFetch.mockResolvedValueOnce(okUser());
      await auth.bindOAuth("github", "c", "s");
      expect(mockFetch.mock.calls.at(-1)![1].method).toBe("POST");

      mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: vi.fn() });
      const unbound = await auth.unbindOAuth("github");
      expect(unbound).toBeNull();
    });
  });

  describe("files 二进制与上传端点", () => {
    it("upload 成功返回 JSON", async () => {
      setTokens("a", "r");
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ file: { name: "x.png" } }) });
      const res = await files.upload(new File(["d"], "x.png"));
      expect(res.file.name).toBe("x.png");
      const opts = mockFetch.mock.calls[0][1];
      expect(opts.method).toBe("POST");
      // FormData 上传不应强制 JSON Content-Type
      expect(opts.headers).toEqual({ Authorization: "Bearer a" });
    });

    it("upload 失败抛错", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 413, json: async () => ({ error: "太大" }) });
      await expect(files.upload(new File(["d"], "x.png"))).rejects.toThrow("太大");
    });

    it("downloadOutput 构造产物 URL", () => {
      expect(files.downloadOutput(7)).toContain("/api/v1/files/outputs/7");
    });

    it("fetchOutputBlob 带 token 拉取 Blob", async () => {
      setTokens("a", "r");
      const blob = new Blob(["x"], { type: "video/mp4" });
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, blob: async () => blob });
      const res = await files.fetchOutputBlob(7);
      expect(res).toBe(blob);
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe("Bearer a");
    });

    it("fetchUploadBlob 失败抛带 HTTP 状态的错误", async () => {
      setTokens("a", "r");
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, blob: async () => new Blob() });
      await expect(files.fetchUploadBlob("missing.png")).rejects.toThrow("HTTP 404");
    });
  });

  describe("tasks.delete / get 详尽", () => {
    it("delete 返回 null（204）", async () => {
      setTokens("a", "r");
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: vi.fn() });
      const res = await tasks.delete(5);
      expect(res).toBeNull();
      expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
    });
  });
});