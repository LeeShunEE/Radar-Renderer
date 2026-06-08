/**
 * 编辑器与预览旅程 e2e（testenv，连真实后端 + 真实库）。
 *
 * 覆盖：登录后编辑器加载、Tab 切换、预览渲染雷达（DOM 校验）、
 * 修改数值后评级实时重算。
 *
 * 说明：预览基于 Remotion <Player>，其渲染内容用 DOM 断言校验（svg/polygon/文本），
 * 不依赖像素截图（截图对 Player 内容捕获不可靠）。
 */
import { test, expect, type Page } from "@playwright/test";

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

test.describe("编辑器与预览旅程", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLanding(page);
  });

  test("编辑器加载且 8 个功能 Tab 均存在", async ({ page }) => {
    for (const name of ["配置", "全局", "对比", "数值", "页面", "素材", "任务", "导出"]) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
    }
  });

  test("切换到数值 Tab 显示雷达数值表（含 Hero / STR）", async ({ page }) => {
    await page.getByRole("tab", { name: "数值" }).click();
    await expect(page.getByText("雷达数值表")).toBeVisible();
    await expect(page.getByText("STR", { exact: true })).toBeVisible();
    await expect(page.locator('input[value="Hero"]')).toBeVisible();
  });

  test("预览区渲染雷达图（DOM 含 svg 多边形与属性文本）", async ({ page }) => {
    // Remotion Player 内容渲染进 DOM：应存在 svg、polygon/path 与文本节点。
    await expect
      .poll(async () => page.locator("svg polygon, svg path").count(), { timeout: 10000 })
      .toBeGreaterThan(0);
    const svgTexts = await page.locator("svg text").count();
    expect(svgTexts).toBeGreaterThan(0);
  });

  test("修改属性数值后评级实时重算（200 → 顶级 X）", async ({ page }) => {
    await page.getByRole("tab", { name: "数值" }).click();
    const firstValue = page.locator('table input[type="number"]').first();
    await expect(firstValue).toBeVisible();

    await firstValue.fill("200");
    await firstValue.blur();

    // 200 对应最高档 "X"（见 lib/rating.ts TIERS）。
    await expect(page.getByText("X", { exact: true }).first()).toBeVisible();
  });
});
