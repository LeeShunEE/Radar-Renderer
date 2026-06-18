/**
 * UserMenu 单元测试：mock useAuth + useRouter，验证无用户/显示/登出跳转。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "@/components/auth/UserMenu";
import { __router } from "next/navigation";

const auth = vi.hoisted(() => ({
  value: {
    user: null as null | { username: string },
    logout: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => auth.value,
}));

describe("UserMenu", () => {
  beforeEach(() => {
    auth.value = { user: { username: "alice" }, logout: vi.fn().mockResolvedValue(undefined) };
    __router.push.mockReset();
  });

  it("无用户时不渲染任何内容", () => {
    auth.value = { user: null, logout: vi.fn() };
    const { container } = render(<UserMenu />);
    expect(container).toBeEmptyDOMElement();
  });

  it("显示用户名与登出按钮", () => {
    render(<UserMenu />);
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /登出/ })).toBeInTheDocument();
  });

  it("点击登出调用 logout 并跳转 /login", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);
    await user.click(screen.getByRole("button", { name: /登出/ }));
    expect(auth.value.logout).toHaveBeenCalledTimes(1);
    expect(__router.push).toHaveBeenCalledWith("/login");
  });
});
