import { expect, test } from "@playwright/test";
import { registerAndLanding } from "./auth-helpers";

test.describe("全局页面编排", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLanding(page);
    await page.getByRole("tab", { name: "全局" }).click();
  });

  test("对比绑定的两页作为原子组一起拖动", async ({ page }) => {
    await page.getByRole("button", { name: "添加页面" }).click();
    await page.getByRole("button", { name: "添加页面" }).click();

    const pageButtons = page.getByRole("button", { name: /^选择页面/ });
    await expect(pageButtons).toHaveCount(3);
    const originalNames = await pageButtons.evaluateAll((buttons) =>
      buttons.map((button) =>
        (button.getAttribute("aria-label") ?? "").replace("选择页面 ", ""),
      ),
    );

    await page
      .getByRole("button", { name: /^将 .+ 与 .+ 设为对比$/ })
      .first()
      .click();
    await expect(
      page.getByRole("group", {
        name: `对比绑定：${originalNames[0]} 与 ${originalNames[1]}`,
      }),
    ).toBeVisible();

    const groupHandle = page
      .getByRole("button", {
        name: `拖动对比组 ${originalNames[0]} 与 ${originalNames[1]}`,
      })
      .first();
    await groupHandle.focus();
    await groupHandle.press("Space");
    await expect(groupHandle).toHaveAttribute("aria-pressed", "true");
    await groupHandle.press("ArrowDown");
    await expect(page.getByRole("status")).toContainText(
      `当前位于页面 ${originalNames[2]}`,
    );
    await groupHandle.press("Space");

    await expect
      .poll(async () =>
        pageButtons.evaluateAll((buttons) =>
          buttons.map((button) =>
            (button.getAttribute("aria-label") ?? "").replace("选择页面 ", ""),
          ),
        ),
      )
      .toEqual([originalNames[2], originalNames[0], originalNames[1]]);
    await expect(
      page.getByRole("group", {
        name: `对比绑定：${originalNames[0]} 与 ${originalNames[1]}`,
      }),
    ).toBeVisible();
  });
});
