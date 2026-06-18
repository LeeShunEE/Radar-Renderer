/**
 * AuthGuard 单元测试：mock useAuth，验证 loading/未认证重定向/已认证放行。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { __router } from "next/navigation";

const auth = vi.hoisted(() => ({
  value: { isAuthenticated: false, loading: true },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => auth.value,
}));

describe("AuthGuard", () => {
  beforeEach(() => {
    auth.value = { isAuthenticated: false, loading: true };
    __router.replace.mockReset();
  });

  it("loading 时显示加载中且不渲染子组件", () => {
    auth.value = { isAuthenticated: false, loading: true };
    render(
      <AuthGuard>
        <div>secret</div>
      </AuthGuard>,
    );
    expect(screen.getByText("加载中…")).toBeInTheDocument();
    expect(screen.queryByText("secret")).toBeNull();
    expect(__router.replace).not.toHaveBeenCalled();
  });

  it("未认证时重定向到 /login 且不渲染子组件", () => {
    auth.value = { isAuthenticated: false, loading: false };
    render(
      <AuthGuard>
        <div>secret</div>
      </AuthGuard>,
    );
    expect(__router.replace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("已认证时渲染子组件且不重定向", () => {
    auth.value = { isAuthenticated: true, loading: false };
    render(
      <AuthGuard>
        <div>secret</div>
      </AuthGuard>,
    );
    expect(screen.getByText("secret")).toBeInTheDocument();
    expect(__router.replace).not.toHaveBeenCalled();
  });
});
