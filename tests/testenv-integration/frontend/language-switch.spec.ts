/**
 * 语言切换旅程 e2e（testenv，连真实后端 + 真实库）。
 *
 * 覆盖：默认 locale=en → 点 LanguageSwitcher 切 zh → 文案变中文且写 NEXT_LOCALE Cookie
 * → 再切回 en → 文案回英文且 Cookie 更新。
 *
 * 选择器策略：本 spec 显式与「文案钉中文」解耦——用 data-testid + lang 属性定位切换器按钮，
 * 用 auth.login 域的稳定副标题文案断言当前语言，不依赖具体业务措辞。
 *
 * 与其余 spec 不同：本 spec 覆盖全局 storageState，从「无 NEXT_LOCALE Cookie」起步，
 * 以验证硬默认 en（见 src/i18n/config.ts）与切换后的 Cookie 写入。
 */
import { test, expect } from "@playwright/test";

// 清空全局预置的 NEXT_LOCALE=zh Cookie，让应用回落到硬默认 en。
test.use({ storageState: { cookies: [], origins: [] } });

// LanguageSwitcher 挂在 (auth) 布局，故 /login（公开页，无需登录）即可见。
const LOGIN_SUBTITLE_EN = "Sign in to use the Radar Chart Animation Generator";
const LOGIN_SUBTITLE_ZH = "登录以使用雷达图动画生成器";

const switcher = '[data-testid="language-switcher"]';

async function getLocaleCookie(context: import("@playwright/test").BrowserContext) {
  const cookies = await context.cookies();
  return cookies.find((c) => c.name === "NEXT_LOCALE")?.value;
}

test.describe("语言切换旅程", () => {
  test("默认英文 → 切中文 → 切回英文，文案与 Cookie 同步", async ({ page, context }) => {
    await page.goto("/login");

    // 硬默认 en：副标题为英文，切换器可见。
    await expect(page.locator(switcher)).toBeVisible();
    await expect(page.getByText(LOGIN_SUBTITLE_EN)).toBeVisible();

    // 点「中文」按钮（按 lang 属性定位，去耦合按钮文案）。
    await page.locator(`${switcher} button[lang="zh"]`).click();

    // 文案切中文，NEXT_LOCALE Cookie 写为 zh。
    await expect(page.getByText(LOGIN_SUBTITLE_ZH)).toBeVisible();
    await expect(page.locator(`${switcher} button[lang="zh"]`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await getLocaleCookie(context)).toBe("zh");

    // 再切回英文，文案回退、Cookie 更新。
    await page.locator(`${switcher} button[lang="en"]`).click();
    await expect(page.getByText(LOGIN_SUBTITLE_EN)).toBeVisible();
    await expect(page.locator(`${switcher} button[lang="en"]`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await getLocaleCookie(context)).toBe("en");
  });
});
