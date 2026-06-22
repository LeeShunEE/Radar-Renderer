/**
 * 认证测试辅助函数（testenv，连真实后端 + 真实库）。
 *
 * 适配新的统一 onboarding 流程：
 * /register（邮箱）→ 发送验证码 → 输入验证码 → /welcome（设置用户名+密码）→ /app
 */

import { test, expect, type Page } from "@playwright/test";

/** 生成唯一用户标识 */
export function uniqueTag(): string {
  return `${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
}

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

/** 注册并进入 /app（新流程：邮箱验证码 → welcome） */
export async function registerAndLanding(page: Page): Promise<{
  email: string;
  username: string;
  password: string;
}> {
  const tag = uniqueTag();
  const email = `e2e_${tag}@test.com`;
  const username = `e2e_${tag}`;
  const password = "password123";

  // Step 1: 输入邮箱并发送验证码
  await page.goto("/register");
  await page.getByPlaceholder("输入邮箱").fill(email);
  await page.getByRole("button", { name: "发送验证码" }).click();
  // 等待验证码发送（可能显示"验证码已发送"或倒计时）
  await expect(page.getByText(/验证码已发送/).first()).toBeVisible({
    timeout: 10_000,
  });

  // Step 2: 获取验证码并输入
  const baseURL = "http://localhost:13000";
  const code = await fetchVerificationCode(baseURL, email);
  await page.getByPlaceholder("输入 6 位验证码").fill(code);
  await page.getByRole("button", { name: "注册" }).click();

  // Step 3: 跳转到 welcome，设置用户名和密码
  await expect(page).toHaveURL(/\/welcome$/, { timeout: 10_000 });
  await page.getByPlaceholder("输入用户名（3-64 字符）").fill(username);
  await page.getByPlaceholder("输入密码（至少 8 位）").fill(password);
  await page.getByRole("button", { name: "完成" }).click();

  // Step 4: 进入 /app
  await expect(page).toHaveURL(/\/app$/, { timeout: 10_000 });
  await expect(page.getByText(username)).toBeVisible();

  return { email, username, password };
}

/** 登录已有用户 */
export async function login(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("输入用户名或邮箱").fill(username);
  await page.getByPlaceholder("输入密码").fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 10_000 });
}

/** 登出 */
export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "登出" }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
}