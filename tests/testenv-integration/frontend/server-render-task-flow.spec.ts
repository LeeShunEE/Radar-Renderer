/**
 * 服务端渲染任务旅程 e2e（testenv，连真实后端 + 真实库 + 真实 render-worker）。
 *
 * 覆盖：提交服务端 MP4 渲染 → 任务进入队列 → 渲染完成 → 自动触发下载、
 * 任务面板展示完成任务并可删除。
 *
 * 前置：render-worker（默认 localhost:3100）需在运行，且后端 worker_base_url 指向它。
 * 渲染为真实 Remotion 出帧，较慢，故放宽超时。
 *
 * 回归点（bug #4）：useServerRender 监听 effect 此前用 isPolling 作前置守卫，
 * 而轮询拉到 done 的同一批次会 setTask(done)+stop()(isPolling=false)，
 * React 批处理后 effect 永远看不到 done → 不触发下载。本用例以“下载事件必触发”守门。
 */
import { test, expect, type Page } from "@playwright/test";

// 真实渲染较慢（Remotion 出帧），单用例放宽到 2 分钟。
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

async function submitMp4Render(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "导出" }).click();
  // 默认渲染方式即“服务端”。
  await page.getByRole("button", { name: "导出当前页 MP4" }).click();
}

test.describe("服务端渲染任务旅程", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLanding(page);
  });

  test("提交 MP4 渲染：完成后自动触发下载（含 #4 回归）", async ({ page }) => {
    await page.getByRole("tab", { name: "导出" }).click();
    // 提交后状态文案进入提交/排队/渲染。
    const downloadPromise = page.waitForEvent("download", { timeout: 110_000 });
    await page.getByRole("button", { name: "导出当前页 MP4" }).click();

    await expect(page.getByText(/提交任务|排队中|渲染中/)).toBeVisible();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^render-\d+\.mp4$/);
    // 下载完成后状态文案落到“下载完成”。
    await expect(page.getByText("下载完成")).toBeVisible({ timeout: 15_000 });
  });

  test("任务面板展示完成任务并可删除", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download", { timeout: 110_000 });
    await submitMp4Render(page);
    await downloadPromise; // 等渲染完成

    await page.getByRole("tab", { name: "任务" }).click();
    await expect(page.getByText("完成")).toBeVisible({ timeout: 10_000 });

    // 删除该完成任务（无 confirm 对话框，直接删）。
    await page.locator("button:has(.lucide-trash-2)").first().click();
    await expect(page.getByText("完成")).toHaveCount(0, { timeout: 10_000 });
  });
});
