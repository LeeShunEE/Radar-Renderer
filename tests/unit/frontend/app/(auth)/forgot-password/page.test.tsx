/**
 * forgot-password/page.tsx 单元测试：验证码重置密码两步流程。
 *
 * next/navigation / next/link 通过 vitest alias 注入测试替身。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { __router } from "next/navigation";

const sendVerificationCode = vi.fn();
const resetPassword = vi.fn();
const getAuthState = vi.fn();
vi.mock("@/lib/auth-store", () => ({
  sendVerificationCode: (...args: unknown[]) => sendVerificationCode(...args),
  resetPassword: (...args: unknown[]) => resetPassword(...args),
  getAuthState: () => getAuthState(),
}));

import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";

async function goToResetStep() {
  sendVerificationCode.mockResolvedValue(undefined);
  render(<ForgotPasswordPage />);
  fireEvent.change(screen.getByLabelText("邮箱"), {
    target: { value: "a@b.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
  await screen.findByText("验证码已发送至 a@b.com");
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    __router.push.mockReset();
    sendVerificationCode.mockReset();
    resetPassword.mockReset();
    getAuthState.mockReset();
  });

  it("步骤1以 reset_password purpose 发送验证码", async () => {
    sendVerificationCode.mockResolvedValue(undefined);
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "a@b.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));

    await waitFor(() =>
      expect(sendVerificationCode).toHaveBeenCalledWith(
        "a@b.com",
        "reset_password",
      ),
    );
  });

  it("两次密码不一致时报错", async () => {
    await goToResetStep();
    resetPassword.mockResolvedValue(undefined);

    fireEvent.change(screen.getByLabelText("验证码"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("新密码"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("确认新密码"), {
      target: { value: "different1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "重置密码" }));

    expect(
      await screen.findByText("两次输入的密码不一致"),
    ).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("重置成功且 username 已存在 → /app", async () => {
    await goToResetStep();
    resetPassword.mockResolvedValue(undefined);
    getAuthState.mockReturnValue({ user: { username: "alice" } });

    fireEvent.change(screen.getByLabelText("验证码"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("新密码"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("确认新密码"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "重置密码" }));

    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith(
        "a@b.com",
        "123456",
        "password123",
      ),
    );
    await waitFor(() => expect(__router.push).toHaveBeenCalledWith("/app"));
  });

  it("重置成功但 username 为空 → /welcome", async () => {
    await goToResetStep();
    resetPassword.mockResolvedValue(undefined);
    getAuthState.mockReturnValue({ user: { username: null } });

    fireEvent.change(screen.getByLabelText("验证码"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("新密码"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("确认新密码"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "重置密码" }));

    await waitFor(() => expect(__router.push).toHaveBeenCalledWith("/welcome"));
  });
});
