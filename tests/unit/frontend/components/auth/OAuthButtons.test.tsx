/**
 * OAuthButtons 单元测试：根据后端 provider 探测结果优雅降级。
 *
 * - 只渲染已配置的 provider 按钮
 * - 两者皆未配置 / 探测失败 → 不渲染
 * - 点击发起登录失败时显示错误文案而非抛未处理异常
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

import { OAuthButtons } from "@/components/auth/OAuthButtons";

const oauthProviders = vi.fn();
const startOAuthLogin = vi.fn();

vi.mock("@/lib/api-client", () => ({
  auth: { oauthProviders: () => oauthProviders() },
}));

vi.mock("@/lib/auth-store", () => ({
  startOAuthLogin: (provider: string) => startOAuthLogin(provider),
}));

describe("OAuthButtons", () => {
  beforeEach(() => {
    oauthProviders.mockReset();
    startOAuthLogin.mockReset();
  });

  it("只渲染已配置的 provider 按钮", async () => {
    oauthProviders.mockResolvedValue({ google: true, github: false });
    render(<OAuthButtons />);

    expect(await screen.findByText("使用 Google 登录")).toBeInTheDocument();
    expect(screen.queryByText("使用 GitHub 登录")).not.toBeInTheDocument();
  });

  it("两者皆未配置时不渲染任何内容", async () => {
    oauthProviders.mockResolvedValue({ google: false, github: false });
    const { container } = render(<OAuthButtons />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("探测失败时不渲染（视为均未启用）", async () => {
    oauthProviders.mockRejectedValue(new Error("network"));
    const { container } = render(<OAuthButtons />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("点击登录失败时显示错误文案且不抛未处理异常", async () => {
    oauthProviders.mockResolvedValue({ google: true, github: false });
    startOAuthLogin.mockRejectedValue(new Error("Google OAuth 未配置"));
    render(<OAuthButtons />);

    const btn = await screen.findByText("使用 Google 登录");
    fireEvent.click(btn);

    expect(await screen.findByText("Google OAuth 未配置")).toBeInTheDocument();
    expect(startOAuthLogin).toHaveBeenCalledWith("google");
  });
});
