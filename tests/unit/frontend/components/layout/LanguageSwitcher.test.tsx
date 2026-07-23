/**
 * LanguageSwitcher 单元测试：mock setLocale server action + useRouter，
 * 验证渲染、active 状态、切换调用与同语言 no-op。
 *
 * next-intl 的 useLocale 由全局替身固定返回 "zh"（见 src/test/__mocks__/next-intl.tsx）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { __router } from "next/navigation";

const setLocaleMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/i18n/locale", () => ({ setLocale: setLocaleMock }));

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    setLocaleMock.mockClear();
    __router.refresh.mockReset();
  });

  it("渲染全部受支持语言，并把当前语言标记为 active", () => {
    render(<LanguageSwitcher />);
    const en = screen.getByRole("button", { name: "English" });
    const zh = screen.getByRole("button", { name: "中文" });
    expect(en).toBeInTheDocument();
    // 替身 useLocale 返回 "zh" → 中文按钮 aria-pressed=true
    expect(zh).toHaveAttribute("aria-pressed", "true");
    expect(en).toHaveAttribute("aria-pressed", "false");
  });

  it("点击其它语言写 Cookie 并刷新", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: "English" }));
    expect(setLocaleMock).toHaveBeenCalledWith("en");
    expect(__router.refresh).toHaveBeenCalledTimes(1);
  });

  it("点击当前语言为 no-op（不写 Cookie、不刷新）", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: "中文" }));
    expect(setLocaleMock).not.toHaveBeenCalled();
    expect(__router.refresh).not.toHaveBeenCalled();
  });
});
