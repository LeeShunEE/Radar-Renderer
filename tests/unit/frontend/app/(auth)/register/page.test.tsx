/**
 * register/page.tsx 单元测试：邮箱验证码两步注册流程。
 *
 * next/navigation / next/link 通过 vitest alias 注入测试替身（见 vitest.config）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { __router } from "next/navigation";

const sendVerificationCode = vi.fn();
const registerWithCode = vi.fn();
vi.mock("@/lib/auth-store", () => ({
  sendVerificationCode: (...args: unknown[]) => sendVerificationCode(...args),
  registerWithCode: (...args: unknown[]) => registerWithCode(...args),
}));

import RegisterPage from "@/app/(auth)/register/page";

describe("RegisterPage", () => {
  beforeEach(() => {
    __router.push.mockReset();
    sendVerificationCode.mockReset();
    registerWithCode.mockReset();
  });

  it("步骤1发送验证码后进入步骤2", async () => {
    sendVerificationCode.mockResolvedValue(undefined);
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "a@b.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));

    await waitFor(() =>
      expect(sendVerificationCode).toHaveBeenCalledWith("a@b.com", "register"),
    );
    expect(
      await screen.findByText(/验证码已发送至 a@b\.com/),
    ).toBeInTheDocument();
  });

  it("步骤2提交验证码注册成功后跳转 /welcome", async () => {
    sendVerificationCode.mockResolvedValue(undefined);
    registerWithCode.mockResolvedValue(false);
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "a@b.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
    const codeInput = await screen.findByLabelText("验证码");
    fireEvent.change(codeInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "注册" }));

    await waitFor(() =>
      expect(registerWithCode).toHaveBeenCalledWith("a@b.com", "123456"),
    );
    await waitFor(() => expect(__router.push).toHaveBeenCalledWith("/welcome"));
  });

  it("发送验证码失败时显示错误", async () => {
    sendVerificationCode.mockRejectedValue(new Error("冷却中"));
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "a@b.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));

    expect(await screen.findByText("冷却中")).toBeInTheDocument();
    expect(registerWithCode).not.toHaveBeenCalled();
  });
});
