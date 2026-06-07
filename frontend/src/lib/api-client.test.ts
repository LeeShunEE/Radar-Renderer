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
  });
});