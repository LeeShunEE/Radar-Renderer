/**
 * 视频页 + 色键旅程 e2e（testenv，连真实后端 + 真实库 + 真实 render-worker）。
 *
 * 覆盖 issue #19 编辑器全链路中无法在单测/集成测试验证的运行时检查点：
 *   - 添加视频页 → 上传绿幕小样例并选中 → 时长自动探测回填
 *     （样例为 MediaRecorder 生成的流式 webm，duration=Infinity，
 *      恰好走 probeDurationInFrames 的 seek 兜底分支）。
 *   - 开启色键 + 绿幕预设后，单页预览在 Remotion Player 中真实渲染
 *     VideoPage（DOM 断言 video-page-video）。
 *   - 视频页 single 导出禁用 + 提示改用全部页面导出（Task 3.4 守卫）。
 *   - 全部页面导出：提交服务端多页渲染（雷达页 + 色键视频页混排），
 *     轮询完成并触发下载。
 *
 * 前置：dev-override 栈（13000 前端 / 18000 后端 / 13100 worker）。
 * baseURL 与库 seed 由测试系统注入（见 CLAUDE.md §3.3.1），不硬编码。
 */
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { registerAndLanding } from "./auth-helpers";

const SAMPLE_GREEN_VIDEO = path.join(
  __dirname,
  "../../data/frontend/video-page-chroma-key/green-screen.webm",
);

/** 全局 Tab 中添加一个视频页（追加到页面列表末尾）。 */
async function addVideoPage(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "全局" }).click();
  await page.getByRole("button", { name: "+ 添加视频页" }).click();
}

/** 动画细节（pages）Tab 中打开视频页配置面板（视频页面板无折叠，直接可见）。 */
async function openVideoPagePanel(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "动画细节" }).click();
  await expect(page.getByRole("heading", { name: "视频页配置" })).toBeVisible();
}

/**
 * 在视频页配置面板上传绿幕样例并选中。
 * 视频页素材选择器 accept="video/*"（雷达页背景面板默认折叠，不产生同类输入）。
 */
async function uploadAndSelectGreenVideo(page: Page): Promise<void> {
  await page.locator('input[accept="video/*"]').setInputFiles(SAMPLE_GREEN_VIDEO);
  const thumb = page.locator('button[title="green-screen.webm"]');
  await expect(thumb).toBeVisible({ timeout: 15_000 });
  await thumb.click();
}

/** 预览对象选择器切换到指定页（Select 下拉）。 */
async function selectPreviewPage(page: Page, label: RegExp): Promise<void> {
  await page.getByText("预览对象").locator("..").getByRole("combobox").click();
  await page.getByRole("option", { name: label }).click();
}

test.describe("视频页色键旅程", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLanding(page);
  });

  test("添加视频页 → 上传绿幕样例 → 时长自动探测回填（webm seek 兜底）", async ({
    page,
  }) => {
    await addVideoPage(page);
    await openVideoPagePanel(page);
    await uploadAndSelectGreenVideo(page);

    // 默认 150 帧；2 秒样例经探测应回填为明显更小的帧数（30fps ≈ 60 帧）。
    // 流式 webm duration=Infinity → 走 seek 兜底后仍能得到有限帧数。
    const duration = page.locator('[data-testid="vp-duration"]');
    await expect
      .poll(async () => Number(await duration.inputValue()), { timeout: 15_000 })
      .toBeLessThan(150);
    expect(Number(await duration.inputValue())).toBeGreaterThan(10);
  });

  test("开色键绿幕预设 → 单页预览真实渲染 VideoPage", async ({ page }) => {
    await addVideoPage(page);
    await openVideoPagePanel(page);
    await uploadAndSelectGreenVideo(page);

    // 开启色键 + 绿幕预设。
    await page.locator('[data-testid="vp-chroma-enabled"]').click();
    await page.locator('[data-testid="vp-preset-green"]').click();
    // 色键细项滑杆展开（enabled 后才渲染）。
    await expect(page.locator('[data-testid="vp-similarity"]')).toBeVisible();

    // 切到视频页单页预览：Player 应渲染 VideoPage 的视频元素。
    await selectPreviewPage(page, /第2页：视频2/);
    await expect(page.locator('[data-testid="video-page-video"]')).toBeAttached({
      timeout: 10_000,
    });
  });

  test("视频页 single 导出禁用并提示改用全部页面导出", async ({ page }) => {
    await addVideoPage(page);
    await openVideoPagePanel(page);
    await uploadAndSelectGreenVideo(page);

    // 激活视频页（单页预览对象 = 视频页）。
    await selectPreviewPage(page, /第2页：视频2/);

    await page.getByRole("tab", { name: "导出" }).click();
    await expect(page.getByRole("button", { name: "导出当前页 MP4" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "导出当前页 GIF" })).toBeDisabled();
    await expect(page.getByText(/视频页请用全部页面导出/)).toBeVisible();
  });

  test("全部页面导出：雷达页 + 色键视频页混排渲染完成并触发下载", async ({
    page,
  }) => {
    // 多页（雷达 + 视频）真实 Remotion 出帧较慢，放宽超时。
    test.setTimeout(300_000);

    await addVideoPage(page);
    await openVideoPagePanel(page);
    await uploadAndSelectGreenVideo(page);
    await page.locator('[data-testid="vp-chroma-enabled"]').click();
    await page.locator('[data-testid="vp-preset-green"]').click();

    await page.getByRole("tab", { name: "导出" }).click();
    await page.getByRole("button", { name: "渲染全部页面" }).click();
    const downloadPromise = page.waitForEvent("download", { timeout: 280_000 });
    await page.getByRole("button", { name: "导出全部 MP4" }).click();
    await expect(page.getByText(/提交任务|排队中|渲染中/)).toBeVisible();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^render-\d+\.mp4$/);
    await expect(page.getByText("下载完成")).toBeVisible({ timeout: 15_000 });
  });
});
