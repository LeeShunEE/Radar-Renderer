/**
 * 认证旅程 e2e（testenv，连真实后端 + 真实库）。
 *
 * 覆盖：注册→自动登录→/app、登出、登录、AuthGuard 重定向、
 * 注册表单校验、错误凭据（含登录失败后按钮不卡死的回归）。
 */
import { test, expect, type Page } from "@playwright/test";

/** 每次运行用唯一用户名，避免真实库里的唯一约束冲突。 */
function uniqueUser(): { username: string; email: string; password: string } {
  const tag = `${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
  return {
    username: `e2e_${tag}`,
    email: `e2e_${tag}@test.com`,
    password: "password123",
  };
}

async function fillRegister(
  page: Page,
  u: { username: string; email: string; password: string },
  confirm = u.password,
): Promise<void> {
  await page.getByPlaceholder("输入用户名（3-64 字符）").fill(u.username);
  await page.getByPlaceholder("输入邮箱").fill(u.email);
  await page.getByPlaceholder("输入密码（至少 8 位）").fill(u.password);
  await page.getByPlaceholder("再次输入密码").fill(confirm);
}

test.describe("认证旅程", () => {
  test("注册后自动登录并跳转 /app，登出回到 /login", async ({ page }) => {
    const u = uniqueUser();
    await page.goto("/register");
    await fillRegister(page, u);
    await page.getByRole("button", { name: "注册" }).click();

    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText(u.username)).toBeVisible();

    await page.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("已注册用户可登录并进入 /app", async ({ page }) => {
    const u = uniqueUser();
    // 先注册建立账号，再登出，验证纯登录路径。
    await page.goto("/register");
    await fillRegister(page, u);
    await page.getByRole("button", { name: "注册" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByPlaceholder("输入用户名").fill(u.username);
    await page.getByPlaceholder("输入密码").fill(u.password);
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText(u.username)).toBeVisible();
  });

  test("未登录访问 /app 被 AuthGuard 重定向到 /login", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("注册校验：两次密码不一致时拦截并提示", async ({ page }) => {
    const u = uniqueUser();
    await page.goto("/register");
    await fillRegister(page, u, "different123");
    await page.getByRole("button", { name: "注册" }).click();

    await expect(page.getByText("两次输入的密码不一致")).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("注册校验：密码少于 8 位被原生校验拦截，不提交", async ({ page }) => {
    const u = { ...uniqueUser(), password: "short" };
    await page.goto("/register");
    await fillRegister(page, u);
    await page.getByRole("button", { name: "注册" }).click();

    // 密码框带 minLength=8，浏览器原生校验在提交前拦截：停留在 /register，
    // 且密码框处于 tooShort 非法态（JS 的 <8 兜底因此不会触发）。
    await expect(page).toHaveURL(/\/register$/);
    const tooShort = await page
      .getByPlaceholder("输入密码（至少 8 位）")
      .evaluate((el: HTMLInputElement) => el.validity.tooShort);
    expect(tooShort).toBe(true);
  });

  test("错误凭据：提示错误且登录按钮不卡在“登录中…”", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("输入用户名").fill("nonexistent_user_xyz");
    await page.getByPlaceholder("输入密码").fill("wrongpassword");
    const submit = page.getByRole("button", { name: /登录/ });
    await submit.click();

    await expect(page.getByText("用户名或密码错误")).toBeVisible();
    // 回归：登录失败后 loading 必须复位，按钮文案回到“登录”且可再次点击。
    await expect(submit).toHaveText("登录");
    await expect(submit).toBeEnabled();
    await expect(page).toHaveURL(/\/login$/);
  });
});
