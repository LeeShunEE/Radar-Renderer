/**
 * 认证旅程 e2e（testenv，连真实后端 + 真实库）。
 *
 * 覆盖：注册→自动登录→/app、登出、登录、AuthGuard 重定向、
 * 注册表单校验、错误凭据（含登录失败后按钮不卡死的回归）。
 */
import { test, expect, type Page } from "@playwright/test";
import { registerAndLanding, login, logout, uniqueTag } from "./auth-helpers";

/** 通过测试端点获取验证码 */
async function fetchVerificationCode(
  baseURL: string,
  email: string,
  purpose: string = "register",
): Promise<string> {
  const resp = await fetch(
    `${baseURL}/api/v1/auth/test/latest-code?email=${encodeURIComponent(email)}&purpose=${purpose}`,
  );
  if (!resp.ok) {
    throw new Error(`获取验证码失败: ${resp.status}`);
  }
  const data = (await resp.json()) as { code: string | null };
  if (!data.code) {
    throw new Error("验证码不存在或已过期");
  }
  return data.code;
}

/** 注册到 welcome 页面（不完成设置） */
async function registerToWelcome(page: Page): Promise<{ email: string }> {
  const tag = uniqueTag();
  const email = `e2e_${tag}@test.com`;

  await page.goto("/register");
  await page.getByPlaceholder("输入邮箱").fill(email);
  await page.getByRole("button", { name: "发送验证码" }).click();
  await expect(page.getByText(/验证码已发送/).first()).toBeVisible({
    timeout: 10_000,
  });

  const baseURL = "http://localhost:13000";
  const code = await fetchVerificationCode(baseURL, email);
  await page.getByPlaceholder("输入 6 位验证码").fill(code);
  await page.getByRole("button", { name: "注册" }).click();

  await expect(page).toHaveURL(/\/welcome$/, { timeout: 10_000 });
  return { email };
}

test.describe("认证旅程", () => {
  test("注册后自动进入 welcome，设置用户名后跳转 /app，登出回到 /login", async ({
    page,
  }) => {
    const { username } = await registerAndLanding(page);
    await expect(page.getByText(username)).toBeVisible();
    await logout(page);
  });

  test("已注册用户可登录并进入 /app", async ({ page }) => {
    const { username, password } = await registerAndLanding(page);
    await logout(page);
    await login(page, username, password);
    await expect(page.getByText(username)).toBeVisible();
  });

  test("未登录访问 /app 被 AuthGuard 重定向到 /login", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login$/);
  });

  // === 验证码流程校验 ===

  test("注册流程：验证码发送后倒计时显示", async ({ page }) => {
    const email = `e2e_${uniqueTag()}@test.com`;
    await page.goto("/register");
    await page.getByPlaceholder("输入邮箱").fill(email);
    await page.getByRole("button", { name: "发送验证码" }).click();
    await expect(page.getByRole("button", { name: /s 后可重发/ })).toBeVisible({ timeout: 10_000 });
  });

  test("注册流程：错误验证码提示", async ({ page }) => {
    const email = `e2e_${uniqueTag()}@test.com`;
    await page.goto("/register");
    await page.getByPlaceholder("输入邮箱").fill(email);
    await page.getByRole("button", { name: "发送验证码" }).click();
    await expect(page.getByText(/验证码已发送/).first()).toBeVisible({
      timeout: 10_000,
    });

    await page.getByPlaceholder("输入 6 位验证码").fill("000000");
    await page.getByRole("button", { name: "注册" }).click();
    await expect(page.getByText(/验证码无效|验证码错误/)).toBeVisible({
      timeout: 10_000,
    });
  });

  // === Welcome 页面校验 ===

  test("welcome 页面：用户名少于 3 位被拦截", async ({ page }) => {
    await registerToWelcome(page);

    await page.getByPlaceholder("输入用户名（3-64 字符）").fill("ab");
    await page.getByPlaceholder("输入密码（至少 8 位）").fill("password123");
    await page.getByRole("button", { name: "完成" }).click();

    // 浏览器原生校验 minLength=3 拦截
    const input = page.getByPlaceholder("输入用户名（3-64 字符）");
    const tooShort = await input.evaluate((el: HTMLInputElement) => el.validity.tooShort);
    expect(tooShort).toBe(true);
    await expect(page).toHaveURL(/\/welcome$/);
  });

  test("welcome 页面：密码少于 8 位被拦截", async ({ page }) => {
    await registerToWelcome(page);

    await page.getByPlaceholder("输入用户名（3-64 字符）").fill(`e2e_${uniqueTag()}`);
    await page.getByPlaceholder("输入密码（至少 8 位）").fill("short");
    await page.getByRole("button", { name: "完成" }).click();

    // 浏览器原生校验 minLength=8 拦截
    const input = page.getByPlaceholder("输入密码（至少 8 位）");
    const tooShort = await input.evaluate((el: HTMLInputElement) => el.validity.tooShort);
    expect(tooShort).toBe(true);
    await expect(page).toHaveURL(/\/welcome$/);
  });

  // === 登录错误凭据回归 ===

  test("错误凭据：提示错误且登录按钮不卡在登录中", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("输入用户名或邮箱").fill("nonexistent_user_xyz");
    await page.getByPlaceholder("输入密码").fill("wrongpassword");
    const submit = page.getByRole("button", { name: "登录", exact: true });
    await submit.click();

    await expect(page.getByText("用户名或密码错误")).toBeVisible({ timeout: 10_000 });
    // 回归：登录失败后 loading 必须复位，按钮文案回到"登录"且可再次点击。
    await expect(submit).toHaveText("登录", { timeout: 10_000 });
    await expect(submit).toBeEnabled();
    await expect(page).toHaveURL(/\/login$/);
  });
});