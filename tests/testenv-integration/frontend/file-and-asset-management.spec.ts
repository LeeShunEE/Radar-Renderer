/**
 * 文件与素材旅程 e2e（testenv，连真实后端 + 真实库）。
 *
 * 覆盖：素材面板初始空态、上传文件→列表出现+配额更新、点击文件名鉴权下载、
 * 删除文件→列表移除、公共素材（背景音乐）列举渲染。
 *
 * 回归点（uploads 401）：上传文件下载入口此前是裸 `<a href>` 直链，
 * 不带 token 访问需鉴权的 /files/uploads/{name} 必 401；改为带 token 的
 * Blob 下载（点击文件名 → fetchUploadBlob → 触发保存）。
 */
import path from "node:path";
import { test, expect } from "@playwright/test";
import { registerAndLanding } from "./auth-helpers";

const SAMPLE_PNG = path.join(
  __dirname,
  "../../data/frontend/file-and-asset-management/sample.png",
);

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

    // 文件名现为按钮（点击走带 token 的 Blob 下载，而非裸 <a href> 直链）。
    const fileButton = page.getByRole("button", { name: "sample.png" });
    await expect(fileButton).toBeVisible();
    // 70B 文件上传后配额不再是 0 B。
    await expect(page.getByText("暂无上传文件")).toHaveCount(0);

    // 删除走原生 confirm()，注册对话框处理器自动确认。
    page.on("dialog", (d) => d.accept());
    await page.locator("button:has(.lucide-trash-2)").click();
    // 删除后回到空态。
    await expect(page.getByText("暂无上传文件")).toBeVisible();
  });

  test("点击文件名鉴权下载上传文件（含 uploads 401 回归）", async ({ page }) => {
    await page.getByRole("tab", { name: "素材" }).click();
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_PNG);

    const fileButton = page.getByRole("button", { name: "sample.png" });
    await expect(fileButton).toBeVisible();

    // 点击文件名应触发带 token 的 Blob 下载；裸直链会 401 而无下载事件。
    const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
    await fileButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("sample.png");
    // 不得出现下载失败提示。
    await expect(page.getByText(/下载文件失败|下载失败/)).toHaveCount(0);
  });

  test("公共素材：全局 Tab 列出背景音乐资源", async ({ page }) => {
    await page.getByRole("tab", { name: "全局" }).click();
    await expect(page.getByText("公共资源")).toBeVisible();
    await expect(page.getByText(/\.flac/)).toBeVisible();
  });
});
