/**
 * 背景媒体旅程 e2e（testenv，连真实后端 + 真实库 + 真实 render-worker）。
 *
 * 覆盖 issue #18 的两个无法在单测/集成测试中验证的运行时检查点：
 *   - Task 2.4 视觉验证：图片/视频背景在 Remotion 预览（Player）中真实渲染进 DOM。
 *   - Task 6.2 Docker 零拷贝：选中视频背景后提交服务端 MP4 渲染，worker 经
 *     _user_media 只读挂载直读上传原件（零拷贝），渲染完成并触发下载。
 *     （“是否零拷贝”是内部实现，GUI 不可见，故由配套 Docker 检查脚本断言
 *      input_props 改写为 _user_media/... 且未复制进 _render_tmp；本 spec 守门用户可见旅程。）
 *
 * 另覆盖 Option B 音频明示（Task 7.3）：开启背景视频声音时，UI 必须展示
 *   “浏览器即时导出不含背景视频声音”的提示（客户端无法渲染背景视频音频）。
 *
 * 前置：dev-override 栈（13000 前端 / 18000 后端 / 13100 worker），backend 置
 *   WORKER_USER_MEDIA_MOUNT=true，worker 已只读挂载 backend_storage 到
 *   publicDir/_user_media（见 deploy/docker-compose.yml）。
 */
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { registerAndLanding } from "./auth-helpers";

const SAMPLE_BG_IMAGE = path.join(
  __dirname,
  "../../data/frontend/background-media/sample-bg.png",
);
const SAMPLE_BG_VIDEO = path.join(
  __dirname,
  "../../data/frontend/background-media/sample-bg.mp4",
);

// backgrounds 的 AssetSelector 文件输入用 accept="image/*,video/*" 唯一标识，
// 区别于剪影（image/*）与音乐（audio/*）的文件输入。
const BG_FILE_INPUT = 'input[accept="image/*,video/*"]';

/** 进入页面 Tab（第 1 页默认展开，背景配置可见）。 */
async function openPagePanel(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "页面" }).click();
  await expect(page.getByRole("heading", { name: "背景配置" })).toBeVisible();
}

/** 切换背景类型（渐变/图片/视频）。 */
async function switchBackgroundType(
  page: Page,
  label: "渐变" | "图片" | "视频",
): Promise<void> {
  await page.getByRole("button", { name: label, exact: true }).click();
}

/** 上传一个背景素材并在“我的上传”网格中选中它。 */
async function uploadAndSelectBackground(
  page: Page,
  filePath: string,
  fileName: string,
): Promise<void> {
  await page.locator(BG_FILE_INPUT).setInputFiles(filePath);
  // 上传完成后缩略图按钮出现（grid 项 title=文件名）。
  const thumb = page.locator(`button[title="${fileName}"]`);
  await expect(thumb).toBeVisible({ timeout: 15_000 });
  await thumb.click();
}

test.describe("背景媒体旅程", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLanding(page);
  });

  test("图片背景：上传选中后在预览中真实渲染（Task 2.4）", async ({ page }) => {
    await openPagePanel(page);
    await switchBackgroundType(page, "图片");
    await uploadAndSelectBackground(page, SAMPLE_BG_IMAGE, "sample-bg.png");

    // 预览（Remotion Player）应渲染出背景图层元素。
    await expect(page.locator('[data-testid="background-media-image"]')).toBeAttached({
      timeout: 10_000,
    });
    // 切回渐变后背景图层移除（分发按 type，见 selectBackgroundKind）。
    await switchBackgroundType(page, "渐变");
    await expect(page.locator('[data-testid="background-media-image"]')).toHaveCount(0);
  });

  test("视频背景：预览渲染 + 开启声音展示客户端无音频提示（Task 2.4 / Option B）", async ({
    page,
  }) => {
    await openPagePanel(page);
    await switchBackgroundType(page, "视频");
    await uploadAndSelectBackground(page, SAMPLE_BG_VIDEO, "sample-bg.mp4");

    // 预览应渲染出背景视频图层。
    await expect(page.locator('[data-testid="background-media-video"]')).toBeAttached({
      timeout: 10_000,
    });

    // 默认静音 → 无提示。
    await expect(
      page.locator('[data-testid="client-export-audio-notice"]'),
    ).toHaveCount(0);

    // 开启声音 → 必须明示“浏览器即时导出不含背景视频声音”（Option B 硬要求）。
    await page.locator('[data-testid="video-muted-switch"]').click();
    const notice = page.locator('[data-testid="client-export-audio-notice"]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("浏览器即时导出不含背景视频声音");
  });

  test("图片背景：提交服务端 MP4 渲染完成并触发下载（零拷贝静态服务诊断）", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await openPagePanel(page);
    await switchBackgroundType(page, "图片");
    await uploadAndSelectBackground(page, SAMPLE_BG_IMAGE, "sample-bg.png");
    await expect(page.locator('[data-testid="background-media-image"]')).toBeAttached({
      timeout: 10_000,
    });
    await page.getByRole("tab", { name: "导出" }).click();
    const downloadPromise = page.waitForEvent("download", { timeout: 140_000 });
    await page.getByRole("button", { name: "导出当前页 MP4" }).click();
    await expect(page.getByText(/提交任务|排队中|渲染中/)).toBeVisible();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^render-\d+\.mp4$/);
    await expect(page.getByText("下载完成")).toBeVisible({ timeout: 15_000 });
  });

  test("视频背景：提交服务端 MP4 渲染完成并触发下载（Task 6.2 零拷贝旅程）", async ({
    page,
  }) => {
    // 真实 Remotion 出帧较慢，放宽超时。
    test.setTimeout(150_000);

    await openPagePanel(page);
    await switchBackgroundType(page, "视频");
    await uploadAndSelectBackground(page, SAMPLE_BG_VIDEO, "sample-bg.mp4");
    await expect(page.locator('[data-testid="background-media-video"]')).toBeAttached({
      timeout: 10_000,
    });

    // 提交服务端渲染（默认即服务端）。
    await page.getByRole("tab", { name: "导出" }).click();
    const downloadPromise = page.waitForEvent("download", { timeout: 140_000 });
    await page.getByRole("button", { name: "导出当前页 MP4" }).click();
    await expect(page.getByText(/提交任务|排队中|渲染中/)).toBeVisible();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^render-\d+\.mp4$/);
    await expect(page.getByText("下载完成")).toBeVisible({ timeout: 15_000 });
  });
});
