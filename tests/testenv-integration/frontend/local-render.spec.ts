/**
 * 本地浏览器渲染旅程 e2e（testenv）。
 *
 * 覆盖：导出面板切到“本地浏览器”→ 导出当前页 WebM → 浏览器内逐帧渲染 →
 * 进度推进 → 完成并触发 .webm 下载。
 *
 * 回归点（bug #6）：useLocalRender 通过 `.remotion-player-container` 定位 Player 容器，
 * 而该 class 此前未挂到任何元素上，querySelector 返回 null → 立即抛“找不到 Player 容器元素”，
 * 本地渲染完全不可用。本用例以“下载必触发且不报该错误”守门。
 */
import { test, expect, type Page } from "@playwright/test";

// 浏览器内逐帧截图编码较慢，放宽超时。
test.setTimeout(120_000);

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

test.describe("本地浏览器渲染旅程", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLanding(page);
  });

  test("本地 WebM 渲染：进度推进并触发下载（含 #6 回归）", async ({ page }) => {
    await page.getByRole("tab", { name: "导出" }).click();
    await page.getByRole("button", { name: "本地浏览器" }).click();

    const downloadPromise = page.waitForEvent("download", { timeout: 110_000 });
    await page.getByRole("button", { name: "导出当前页 WebM" }).click();

    // 渲染中文案出现（证明已进入渲染而非立即报错）。
    await expect(page.getByText(/本地渲染中/)).toBeVisible({ timeout: 10_000 });
    // 回归：绝不能出现“找不到 Player 容器元素”。
    await expect(page.getByText("找不到 Player 容器元素")).toHaveCount(0);

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.webm$/);
  });
});
