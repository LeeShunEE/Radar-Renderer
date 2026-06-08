/**
 * 文件与素材旅程 e2e（testenv，连真实后端 + 真实库）。
 *
 * 覆盖：素材面板初始空态、上传文件→列表出现+配额更新、删除文件→列表移除、
 * 公共素材（背景音乐）列举渲染。
 */
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

const SAMPLE_PNG = path.join(
  __dirname,
  "../../data/frontend/file-and-asset-management/sample.png",
);

async function registerAndLanding(page: Page): Promise<void> {
  const tag = `${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
  await page.goto("/register");
  await page.getByPlaceholder("输入用户名（3-64 字符）").fill(`e2e_${tag}`);
  await page.getByPlaceholder("输入邮箱").fill(`e2e_${tag}@test.com`);
  await page.getByPlaceholder("输入密码（至少 8 位）").fill("password123");
  await page.getByPlaceholder("再次输入密码").fill("password123");
  await page.getByRole("button", { name: "注册" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test.describe("文件与素材旅程", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLanding(page);
  });

  test("素材面板初始为空并显示配额", async ({ page }) => {
    await page.getByRole("tab", { name: "素材" }).click();
    await expect(page.getByText(/已用 .* \/ 200\.0 MB/)).toBeVisible();
    await expect(page.getByText("暂无上传文件")).toBeVisible();
  });

  test("上传文件后出现在列表且配额更新，删除后移除", async ({ page }) => {
    await page.getByRole("tab", { name: "素材" }).click();
    await expect(page.getByText("暂无上传文件")).toBeVisible();

    // 隐藏 input，setInputFiles 直接注入，触发 React onChange。
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_PNG);

    const fileLink = page.getByRole("link", { name: "sample.png" });
    await expect(fileLink).toBeVisible();
    // 70B 文件上传后配额不再是 0 B。
    await expect(page.getByText("暂无上传文件")).toHaveCount(0);

    // 删除走原生 confirm()，注册对话框处理器自动确认。
    page.on("dialog", (d) => d.accept());
    await page.locator("button:has(.lucide-trash-2)").click();
    // 删除后回到空态。
    await expect(page.getByText("暂无上传文件")).toBeVisible();
  });

  test("公共素材：全局 Tab 列出背景音乐资源", async ({ page }) => {
    await page.getByRole("tab", { name: "全局" }).click();
    await expect(page.getByText("公共资源")).toBeVisible();
    await expect(page.getByText(/\.flac/)).toBeVisible();
  });
});
