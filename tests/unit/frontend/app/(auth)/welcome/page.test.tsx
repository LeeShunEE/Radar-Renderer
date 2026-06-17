/**
 * welcome/page.tsx 单元测试：统一 onboarding 表单的必填校验与 OAuth 分支。
 *
 * next/navigation 通过 vitest alias 注入测试替身。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { __router } from "next/navigation";

const useAuthUser = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: useAuthUser() }),
}));

const setUsername = vi.fn();
const setPassword = vi.fn();
vi.mock("@/lib/auth-store", () => ({
  setUsername: (...args: unknown[]) => setUsername(...args),
  setPassword: (...args: unknown[]) => setPassword(...args),
}));

const listOAuthAccounts = vi.fn();
vi.mock("@/lib/api-client", () => ({
  auth: { listOAuthAccounts: () => listOAuthAccounts() },
}));

import WelcomePage from "@/app/(auth)/welcome/page";

describe("WelcomePage", () => {
  beforeEach(() => {
    __router.push.mockReset();
    setUsername.mockReset();
    setPassword.mockReset();
    listOAuthAccounts.mockReset();
    // username 空 → 停留在 onboarding
    useAuthUser.mockReturnValue({ username: null });
  });

  it("未绑 OAuth 时密码必填：缺密码报错", async () => {
    listOAuthAccounts.mockResolvedValue([]);
    render(<WelcomePage />);

    await waitFor(() => expect(listOAuthAccounts).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("用户名"), {
      target: { value: "alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: "完成并开始使用" }));

    expect(await screen.findByText("密码长度应至少 8 位")).toBeInTheDocument();
    expect(setUsername).not.toHaveBeenCalled();
  });

  it("未绑 OAuth：填齐用户名+密码后提交成功跳 /app", async () => {
    listOAuthAccounts.mockResolvedValue([]);
    setUsername.mockResolvedValue(undefined);
    setPassword.mockResolvedValue(undefined);
    render(<WelcomePage />);

    await waitFor(() => expect(listOAuthAccounts).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("用户名"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText(/密码/), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "完成并开始使用" }));

    await waitFor(() => expect(setUsername).toHaveBeenCalledWith("alice"));
    await waitFor(() => expect(setPassword).toHaveBeenCalledWith("password123"));
    await waitFor(() => expect(__router.push).toHaveBeenCalledWith("/app"));
  });

  it("已绑 OAuth 时密码可选：仅用户名即可提交", async () => {
    listOAuthAccounts.mockResolvedValue([{ id: 1, provider: "google" }]);
    setUsername.mockResolvedValue(undefined);
    render(<WelcomePage />);

    await waitFor(() => expect(listOAuthAccounts).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("用户名"), {
      target: { value: "alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: "完成并开始使用" }));

    await waitFor(() => expect(setUsername).toHaveBeenCalledWith("alice"));
    await waitFor(() => expect(__router.push).toHaveBeenCalledWith("/app"));
    expect(setPassword).not.toHaveBeenCalled();
  });
});
