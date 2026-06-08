/**
 * 认证状态管理：内存 + localStorage 持久化。
 *
 * 提供 login / register / logout / refreshTokens 方法，
 * 并在启动时检查存量 token 是否有效。
 */
import { auth, setTokens, clearTokens, getAccessToken, getRefreshToken } from "./api-client";

export interface User {
  id: number;
  username: string;
  email: string;
  createdAt: string;
}

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
};

let _state: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: true,
  error: null,
};

type Listener = (state: AuthState) => void;
const _listeners: Set<Listener> = new Set();

function notify() {
  _listeners.forEach((l) => l(_state));
}

export function getAuthState(): AuthState {
  return _state;
}

export function subscribe(listener: Listener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/** 启动时检查 localStorage token 有效性。 */
export async function initializeAuth(): Promise<void> {
  const storedAccess = getAccessToken();
  const storedRefresh = getRefreshToken();

  if (!storedAccess && !storedRefresh) {
    _state = { ..._state, loading: false };
    notify();
    return;
  }

  try {
    const user = await auth.me();
    _state = {
      user: { id: user.id, username: user.username, email: user.email, createdAt: user.created_at },
      accessToken: storedAccess,
      refreshToken: storedRefresh,
      loading: false,
      error: null,
    };
  } catch {
    // stored token 无效，清空
    clearTokens();
    _state = { user: null, accessToken: null, refreshToken: null, loading: false, error: null };
  }
  notify();
}

/** 登录并更新状态。 */
export async function login(username: string, password: string): Promise<void> {
  _state = { ..._state, loading: true, error: null };
  notify();
  try {
    const tokens = await auth.login(username, password);
    setTokens(tokens.access_token, tokens.refresh_token);
    const user = await auth.me();
    _state = {
      user: { id: user.id, username: user.username, email: user.email, createdAt: user.created_at },
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      loading: false,
      error: null,
    };
  } catch (e: any) {
    _state = { ..._state, loading: false, error: e.message ?? "登录失败" };
    // 必须在 throw 前 notify，否则订阅方收不到 loading 复位，按钮会卡在“登录中…”。
    notify();
    throw e;
  }
  notify();
}

/** 注册并更新状态。 */
export async function register(username: string, email: string, password: string): Promise<void> {
  _state = { ..._state, loading: true, error: null };
  notify();
  try {
    const user = await auth.register(username, email, password);
    // 注册后自动登录
    const tokens = await auth.login(username, password);
    setTokens(tokens.access_token, tokens.refresh_token);
    _state = {
      user: { id: user.id, username: user.username, email: user.email, createdAt: user.created_at },
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      loading: false,
      error: null,
    };
  } catch (e: any) {
    _state = { ..._state, loading: false, error: e.message ?? "注册失败" };
    // 必须在 throw 前 notify，否则订阅方收不到 loading 复位，按钮会卡在“注册中…”。
    notify();
    throw e;
  }
  notify();
}

/** 登出并清除状态。 */
export async function logout(): Promise<void> {
  clearTokens();
  _state = { user: null, accessToken: null, refreshToken: null, loading: false, error: null };
  notify();
}

/** 手动刷新 token。 */
export async function refreshTokens(): Promise<void> {
  const storedRefresh = getRefreshToken();
  if (!storedRefresh) {
    throw new Error("无 refresh token");
  }
  const tokens = await auth.refresh(storedRefresh);
  setTokens(tokens.access_token, tokens.refresh_token);
  _state = { ..._state, accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
  notify();
}