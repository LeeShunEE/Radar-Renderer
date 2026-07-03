/**
 * 对比模式「叠加高亮」(overlay) 布局 e2e（testenv，连真实后端 + 真实库）。
 *
 * 覆盖 issue #17 overlay 对比的用户配置旅程与真实渲染：
 *  - 建立对比对后对比配置面板出现，含布局下拉（默认 transition）
 *  - 布局切到「叠加高亮」→ overlay 控件出现、transition 专属控件互斥消失
 *  - seek 到对比段验证 ComparisonOverlayLayer 真挂载（overlay 独有「/」评级分隔符）
 *  - overlay ↔ transition 可来回切换且控件正确互斥
 *
 * 说明：overlay 的关键帧数学（computeOverlayPhases）已由单测覆盖；此处验证真实
 * 后端 + Player 下的配置旅程与叠加图层渲染，不依赖像素截图。叠加图层「真渲染」
 * 用 overlay 独有锚点断言——OverlayVertexLabels 每顶点渲染一个「/」分隔符（8 个），
 * 普通 RadarVideo 评级无此节点；seek 经点击时间轴「强弱箭头」分段（onClick →
 * player.seekTo）触发。
 */
import { test, expect, type Page } from "@playwright/test";
import { registerAndLanding } from "./auth-helpers";

/** 建立 1 个对比对：全局 Tab → 添加第 2 页 → 激活相邻页间对比。 */
async function createComparisonPair(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "全局" }).click();
  // 默认只有 1 页，⚡对比按钮需 totalPages > 1 才渲染，故先加页。
  await page.getByRole("button", { name: /添加页面/ }).click();
  // 相邻页（页1 + 页2）间的对比 toggle，未激活态 title="对比渲染"。
  await page.locator('button[title="对比渲染"]').click();
}

test.describe("对比模式叠加高亮 (overlay) 旅程", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLanding(page);
  });

  test("建立对比对后对比配置面板出现并含布局下拉", async ({ page }) => {
    await createComparisonPair(page);

    await page.getByRole("tab", { name: "对比" }).click();
    await expect(page.getByText("对比配置")).toBeVisible();

    // 布局下拉存在且默认为「切换过渡」（向后兼容）。
    const layoutSelect = page.getByRole("combobox", { name: "对比布局" });
    await expect(layoutSelect).toBeVisible();
    await expect(layoutSelect).toHaveValue("transition");
  });

  test("布局切到叠加高亮时 overlay 控件出现、transition 专属控件互斥消失", async ({
    page,
  }) => {
    await createComparisonPair(page);
    await page.getByRole("tab", { name: "对比" }).click();

    await page
      .getByRole("combobox", { name: "对比布局" })
      .selectOption("叠加高亮（同图双方）");

    // overlay 专属控件出现。
    await expect(
      page.locator('[data-field-id="comparison:0:overlay.glowRadius"]'),
    ).toBeVisible();
    await expect(page.getByText("高亮光晕半径")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "先高亮" })).toBeVisible();

    // transition 专属控件互斥消失（同一段渲染分支不再挂载）。
    await expect(
      page.getByRole("combobox", { name: "第二多边形模式" }),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-field-id="comparison:0:delayFrames"]'),
    ).toHaveCount(0);
  });

  test("seek 到对比段时叠加图层真渲染（overlay 独有「/」评级分隔符）", async ({
    page,
  }) => {
    await createComparisonPair(page);
    // 切 multi 预览：左侧常驻预览渲染整个多页序列，时间轴才出现对比分段
    // （「强弱箭头」等 overlay 分段由 buildMultiSegments 推送，single 模式无）。
    await page.getByRole("button", { name: /全局预览/ }).click();
    await page.getByRole("tab", { name: "对比" }).click();
    await page
      .getByRole("combobox", { name: "对比布局" })
      .selectOption("叠加高亮（同图双方）");

    // 点击时间轴「强弱箭头」分段 seek 到 overlay 段内（phases.p1 帧），
    // 触发 ComparisonOverlayLayer 在该 Sequence 挂载。分段 div 内 span 的
    // textContent 恒为完整「强弱箭头」，不受视觉 ellipsis 截断影响。
    const arrowSeg = page.getByText("强弱箭头", { exact: true }).first();
    await expect(arrowSeg).toBeVisible({ timeout: 10_000 });
    await arrowSeg.click();

    // overlay 独有锚点：OverlayVertexLabels 每个属性顶点渲染一个「/」分隔符
    // （8 属性 → 8 个），普通单页 RadarVideo 评级无此节点。计数 >= 8 即证
    // ComparisonOverlayLayer（含 OverlayVertexLabels）在真实 Player 下真挂载渲染。
    await expect.poll(
      async () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll("svg text")).filter(
            (t) => (t.textContent ?? "").trim() === "/",
          ).length,
        ),
      { timeout: 15_000 },
    ).toBeGreaterThanOrEqual(8);
  });

  test("overlay 与 transition 布局可来回切换且控件正确互斥", async ({ page }) => {
    await createComparisonPair(page);
    await page.getByRole("tab", { name: "对比" }).click();
    const layout = page.getByRole("combobox", { name: "对比布局" });

    // transition → overlay
    await layout.selectOption("叠加高亮（同图双方）");
    await expect(page.getByRole("combobox", { name: "先高亮" })).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "第二多边形模式" }),
    ).toHaveCount(0);

    // overlay → transition（回切，控件对称恢复）
    await layout.selectOption("切换过渡（A→B）");
    await expect(
      page.getByRole("combobox", { name: "第二多边形模式" }),
    ).toBeVisible();
    await expect(page.getByRole("combobox", { name: "先高亮" })).toHaveCount(0);
  });

  test("overlay 配置保存到 localStorage 后刷新加载往返完整保留", async ({
    page,
  }) => {
    // 建对比对 + 切 overlay + 改 glowRadius 为可辨识非默认值（默认 16）
    await createComparisonPair(page);
    await page.getByRole("tab", { name: "对比" }).click();
    await page
      .getByRole("combobox", { name: "对比布局" })
      .selectOption("叠加高亮（同图双方）");
    const glowInput = page.locator(
      '[data-field-id="comparison:0:overlay.glowRadius"] input[type="number"]',
    );
    await glowInput.fill("37");
    await glowInput.blur();

    // 配置存档：保存到 localStorage（useSavedConfigs STORAGE_KEY）
    const configName = `e2e_overlay_${Date.now()}`;
    await page.getByRole("tab", { name: "配置" }).click();
    await page.getByPlaceholder("输入配置名称").fill(configName);
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("已保存!")).toBeVisible();

    // 刷新：config 重置为默认，但 localStorage 存档与登录态保留
    await page.reload();
    await expect(page).toHaveURL(/\/app$/, { timeout: 10_000 });

    // 从存档加载（loadConfig 经 MultiPageSchema.safeParse 反序列化，zod 回填在此触发）
    await page.getByRole("tab", { name: "配置" }).click();
    await page.getByText("选择已保存配置").click();
    await page
      .getByRole("option", { name: configName, exact: true })
      .click();
    await page.getByRole("button", { name: "加载", exact: true }).click();
    await expect(page.getByText("已加载!")).toBeVisible();

    // 断言 overlay 布局与嵌套参数完整恢复（schema 往返不丢字段/值）
    await page.getByRole("tab", { name: "对比" }).click();
    await expect(
      page.getByRole("combobox", { name: "对比布局" }),
    ).toHaveValue("overlay");
    await expect(
      page.locator(
        '[data-field-id="comparison:0:overlay.glowRadius"] input[type="number"]',
      ),
    ).toHaveValue("37");
  });
});
