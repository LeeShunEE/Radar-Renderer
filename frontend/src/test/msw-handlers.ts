/**
 * MSW 2.x handler：覆盖所有后端 API（auth / files / render / tasks / assets）。
 *
 * handler 中引用 fixtures 提供默认 mock 数据，每个测试可按需覆盖。
 */
import { http, HttpResponse } from "msw";
import { mockUser, mockTokenResponse, mockCodeTokenResponse, mockFiles, mockQuota, mockTask } from "./fixtures";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// 默认内存状态（测试可覆盖 handler 改变行为）
let _users: Array<{ id: number; username: string; email: string; password: string }> = [];
let _nextUserId = 1;
let _files = [...mockFiles];
let _tasks: Array<{
  id: number;
  mode: string;
  codec: string;
  status: string;
  input_props: Record<string, unknown>;
  output_path: string;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  position: number;
  eta_seconds: number | null;
}> = [...mockTask];
let _nextTaskId = 1;

/** 重置所有内存状态（在 beforeAll / beforeEach 中调用）。 */
export function resetMockState() {
  _users = [];
  _nextUserId = 1;
  _files = [...mockFiles];
  _tasks = [...mockTask];
  _nextTaskId = 1;
}

export const handlers = [
  // ── Auth ──────────────────────────────────────────────
  // 统一 onboarding：验证码注册收 {email, code}，返回 token + is_new_user（不再返回 user 实体）。
  http.post(`${API_BASE}/api/v1/auth/register`, async ({ request }) => {
    const body = (await request.json()) as { email: string; code: string };
    if (!body.email || !body.code) {
      return HttpResponse.json({ error: "邮箱或验证码缺失", code: "bad_request" }, { status: 400 });
    }
    return HttpResponse.json(mockCodeTokenResponse);
  }),

  http.post(`${API_BASE}/api/v1/auth/register-with-password`, async ({ request }) => {
    const body = (await request.json()) as { username: string; email: string; password: string };
    const user = { id: _nextUserId++, username: body.username, email: body.email, password: body.password };
    _users.push(user);
    return HttpResponse.json({ id: user.id, username: user.username, email: user.email, created_at: new Date().toISOString() }, { status: 201 });
  }),

  // 登录：兼容 {username,password} 与 {email,password}（client 按是否含 @ 切换）。
  // 严格校验 _users（与单元 auth-store.test.ts 的 no-match→401 契约保持一致）。
  // 集成测试若需 login 成功而未走 register-with-password，用 mswServer.use 覆盖为 demo handler。
  http.post(`${API_BASE}/api/v1/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { username?: string; email?: string; password: string };
    const user = _users.find(
      (u) =>
        u.password === body.password &&
        ((body.username !== undefined && u.username === body.username) ||
          (body.email !== undefined && u.email === body.email)),
    );
    if (!user) {
      return HttpResponse.json({ error: "用户名或密码错误", code: "auth_error" }, { status: 401 });
    }
    return HttpResponse.json(mockTokenResponse);
  }),

  http.post(`${API_BASE}/api/v1/auth/send-code`, async ({ request }) => {
    const body = (await request.json()) as { email: string; purpose?: string };
    if (!body.email) {
      return HttpResponse.json({ error: "邮箱缺失", code: "bad_request" }, { status: 400 });
    }
    return HttpResponse.json({ message: "验证码已发送" });
  }),

  // 验证码重置密码并自动登录：返回 token（无 is_new_user）。
  http.post(`${API_BASE}/api/v1/auth/reset-password`, async ({ request }) => {
    const body = (await request.json()) as { email: string; code: string; new_password: string };
    if (!body.email || !body.code || !body.new_password) {
      return HttpResponse.json({ error: "参数缺失", code: "bad_request" }, { status: 400 });
    }
    return HttpResponse.json(mockTokenResponse);
  }),

  http.post(`${API_BASE}/api/v1/auth/refresh`, async () => {
    return HttpResponse.json(mockTokenResponse);
  }),

  http.get(`${API_BASE}/api/v1/auth/me`, ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return HttpResponse.json({ error: "未提供凭证", code: "auth_error" }, { status: 401 });
    }
    return HttpResponse.json(mockUser);
  }),

  http.post(`${API_BASE}/api/v1/auth/set-username`, async ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return HttpResponse.json({ error: "未提供凭证", code: "auth_error" }, { status: 401 });
    }
    const body = (await request.json()) as { username: string };
    return HttpResponse.json({ id: mockUser.id, username: body.username, email: mockUser.email, created_at: mockUser.created_at });
  }),

  http.post(`${API_BASE}/api/v1/auth/set-password`, async ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return HttpResponse.json({ error: "未提供凭证", code: "auth_error" }, { status: 401 });
    }
    return HttpResponse.json({ id: mockUser.id, username: mockUser.username, email: mockUser.email, created_at: mockUser.created_at });
  }),

  // ── OAuth ─────────────────────────────────────────────
  http.get(`${API_BASE}/api/v1/auth/oauth/providers`, () => {
    return HttpResponse.json({ google: true, github: false });
  }),

  http.get(`${API_BASE}/api/v1/auth/oauth/:provider/start`, () => {
    return HttpResponse.json({ auth_url: "https://oauth.example.com/authorize?client_id=test" });
  }),

  http.get(`${API_BASE}/api/v1/auth/oauth/:provider/callback`, () => {
    return HttpResponse.json(mockCodeTokenResponse);
  }),

  // ── Files ─────────────────────────────────────────────
  http.get(`${API_BASE}/api/v1/files`, ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return HttpResponse.json({ error: "未提供凭证", code: "auth_error" }, { status: 401 });
    }
    return HttpResponse.json({ files: _files, quota: mockQuota });
  }),

  http.post(`${API_BASE}/api/v1/files`, async ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return HttpResponse.json({ error: "未提供凭证", code: "auth_error" }, { status: 401 });
    }
    // 简化：返回固定 file entry
    const newFile = { name: "uploaded.png", size_bytes: 2048, modified_at: new Date().toISOString() };
    _files.push(newFile);
    return HttpResponse.json({ file: newFile, quota: mockQuota }, { status: 201 });
  }),

  http.get(`${API_BASE}/api/v1/files/uploads/:name`, () => {
    return new HttpResponse(new Blob(["fake-file-content"]), {
      headers: { "Content-Type": "application/octet-stream" },
    });
  }),

  http.get(`${API_BASE}/api/v1/files/outputs/:taskId`, () => {
    return new HttpResponse(new Blob(["fake-render-output"]), {
      headers: { "Content-Type": "video/mp4" },
    });
  }),

  http.delete(`${API_BASE}/api/v1/files/:name`, ({ params }) => {
    const name = params.name as string;
    _files = _files.filter((f) => f.name !== name);
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Render ────────────────────────────────────────────
  http.post(`${API_BASE}/api/v1/render`, async ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return HttpResponse.json({ error: "未提供凭证", code: "auth_error" }, { status: 401 });
    }
    const body = (await request.json()) as { mode: string; codec: string; input_props: Record<string, unknown> };
    const task = {
      id: _nextTaskId++,
      mode: body.mode,
      codec: body.codec,
      status: "queued",
      input_props: body.input_props,
      output_path: "",
      error: null,
      duration_ms: null,
      created_at: new Date().toISOString(),
      started_at: null,
      finished_at: null,
      position: _tasks.filter((t) => t.status === "queued").length + 1,
      eta_seconds: 30,
    };
    _tasks.push(task);
    return HttpResponse.json(task, { status: 201 });
  }),

  // ── Tasks ─────────────────────────────────────────────
  http.get(`${API_BASE}/api/v1/tasks`, ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return HttpResponse.json({ error: "未提供凭证", code: "auth_error" }, { status: 401 });
    }
    const tasksWithMeta = _tasks.map((t, i) => ({
      ...t,
      position: t.status === "queued" ? i : 0,
      eta_seconds: t.status === "queued" ? 30 : null,
    }));
    return HttpResponse.json({ queue_size: _tasks.filter((t) => t.status === "queued").length, tasks: tasksWithMeta });
  }),

  http.get(`${API_BASE}/api/v1/tasks/:taskId`, ({ params, request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return HttpResponse.json({ error: "未提供凭证", code: "auth_error" }, { status: 401 });
    }
    const taskId = Number(params.taskId);
    const task = _tasks.find((t) => t.id === taskId);
    if (!task) {
      return HttpResponse.json({ error: "任务不存在", code: "task_not_found" }, { status: 404 });
    }
    return HttpResponse.json({
      ...task,
      position: task.status === "queued" ? 1 : 0,
      eta_seconds: task.status === "queued" ? 30 : null,
    });
  }),

  http.delete(`${API_BASE}/api/v1/tasks/:taskId`, ({ params }) => {
    const taskId = Number(params.taskId);
    _tasks = _tasks.filter((t) => t.id !== taskId);
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Assets ────────────────────────────────────────────
  http.get(`${API_BASE}/api/v1/assets/silhouettes`, () => {
    return HttpResponse.json([
      { name: "hero.png", path: "silhouettes/hero.png", size_bytes: 1024 },
      { name: "villain.svg", path: "silhouettes/villain.svg", size_bytes: 512 },
    ]);
  }),

  http.get(`${API_BASE}/api/v1/assets/music`, () => {
    return HttpResponse.json([
      { name: "bgm.mp3", path: "music/bgm.mp3", size_bytes: 4096 },
    ]);
  }),

  http.get(`${API_BASE}/api/v1/assets/:category/:name`, () => {
    return new HttpResponse(new Blob(["fake-asset"]), {
      headers: { "Content-Type": "application/octet-stream" },
    });
  }),
];
