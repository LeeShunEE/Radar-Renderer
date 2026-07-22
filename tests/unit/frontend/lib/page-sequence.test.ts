import { describe, expect, it } from "vitest";
import {
  buildPageSequence,
  duplicatePageInSequence,
  removePageFromSequence,
  reorderPageSequence,
} from "@/lib/page-sequence";
import { defaultMultiPageConfig, defaultRadarProps } from "@/types/constants";
import { ComparisonPairSchema, type MultiPageConfig } from "@/types/radar";

function makeConfig(
  names: string[],
  pairs: Array<[number, number]>,
): MultiPageConfig {
  return {
    ...defaultMultiPageConfig,
    pages: names.map((characterName) => ({
      ...defaultRadarProps,
      characterName,
    })),
    comparisons: pairs.map(([firstPageIndex, secondPageIndex]) =>
      ComparisonPairSchema.parse({ firstPageIndex, secondPageIndex }),
    ),
  };
}

describe("buildPageSequence", () => {
  it("把相邻对比页建模为一个原子序列项", () => {
    const config = makeConfig(["A", "B", "C", "D"], [[1, 2]]);

    expect(buildPageSequence(config)).toEqual([
      { id: "page:0", type: "page", pageIndices: [0] },
      { id: "comparison:1:2", type: "comparison", pageIndices: [1, 2] },
      { id: "page:3", type: "page", pageIndices: [3] },
    ]);
  });

  it("不会把非相邻对比错误聚合为原子项", () => {
    const config = makeConfig(["A", "B", "C"], [[0, 2]]);

    expect(buildPageSequence(config)).toEqual([
      { id: "page:0", type: "page", pageIndices: [0] },
      { id: "page:1", type: "page", pageIndices: [1] },
      { id: "page:2", type: "page", pageIndices: [2] },
    ]);
  });
});

describe("reorderPageSequence", () => {
  it("移动对比组时保持组内顺序并同步索引", () => {
    const config = makeConfig(["A", "B", "C", "D"], [[1, 2]]);

    const result = reorderPageSequence(
      config,
      2,
      "comparison:1:2",
      "page:0",
    );

    expect(result.pages.map((page) => page.characterName)).toEqual([
      "B",
      "C",
      "A",
      "D",
    ]);
    expect(result.comparisons[0]).toMatchObject({
      firstPageIndex: 0,
      secondPageIndex: 1,
    });
    expect(result.activePageIndex).toBe(1);
  });

  it("普通页跨过对比组时不会拆开该组", () => {
    const config = makeConfig(["A", "B", "C", "D"], [[1, 2]]);

    const result = reorderPageSequence(config, 3, "page:3", "page:0");

    expect(result.pages.map((page) => page.characterName)).toEqual([
      "D",
      "A",
      "B",
      "C",
    ]);
    expect(result.comparisons[0]).toMatchObject({
      firstPageIndex: 2,
      secondPageIndex: 3,
    });
    expect(result.activePageIndex).toBe(0);
  });

  it("两个对比组互换时同时重映射两组索引", () => {
    const config = makeConfig(
      ["A", "B", "C", "D"],
      [
        [0, 1],
        [2, 3],
      ],
    );

    const result = reorderPageSequence(
      config,
      0,
      "comparison:0:1",
      "comparison:2:3",
    );

    expect(result.pages.map((page) => page.characterName)).toEqual([
      "C",
      "D",
      "A",
      "B",
    ]);
    expect(result.comparisons).toEqual([
      expect.objectContaining({ firstPageIndex: 0, secondPageIndex: 1 }),
      expect.objectContaining({ firstPageIndex: 2, secondPageIndex: 3 }),
    ]);
    expect(result.activePageIndex).toBe(2);
  });

  it("活动项或落点无效时返回原数据", () => {
    const config = makeConfig(["A", "B"], []);

    const missingActive = reorderPageSequence(
      config,
      0,
      "missing",
      "page:1",
    );
    const missingTarget = reorderPageSequence(
      config,
      0,
      "page:0",
      "missing",
    );

    expect(missingActive.pages).toBe(config.pages);
    expect(missingActive.comparisons).toBe(config.comparisons);
    expect(missingTarget.pages).toBe(config.pages);
    expect(missingTarget.comparisons).toBe(config.comparisons);
  });

  it("落回原位时不创建新数组", () => {
    const config = makeConfig(["A", "B"], []);

    const result = reorderPageSequence(config, 1, "page:1", "page:1");

    expect(result.pages).toBe(config.pages);
    expect(result.comparisons).toBe(config.comparisons);
    expect(result.activePageIndex).toBe(1);
  });
});

describe("duplicatePageInSequence", () => {
  it("复制普通页时把未绑定副本插入当前页后", () => {
    const config = makeConfig(["A", "B"], []);

    const result = duplicatePageInSequence(config, 0);

    expect(result.pages.map((page) => page.characterName)).toEqual([
      "A",
      "A (副本)",
      "B",
    ]);
    expect(result.comparisons).toEqual([]);
    expect(result.insertedPageIndex).toBe(1);
    expect(result.pages[1]).not.toBe(config.pages[0]);
  });

  it("复制绑定成员时把未绑定副本放到整个组后", () => {
    const config = makeConfig(["A", "B", "C", "D"], [[1, 2]]);

    const result = duplicatePageInSequence(config, 1);

    expect(result.pages.map((page) => page.characterName)).toEqual([
      "A",
      "B",
      "C",
      "B (副本)",
      "D",
    ]);
    expect(result.comparisons[0]).toMatchObject({
      firstPageIndex: 1,
      secondPageIndex: 2,
    });
    expect(result.insertedPageIndex).toBe(3);
  });
});

describe("removePageFromSequence", () => {
  it("删除绑定成员时解除对比并保留另一页", () => {
    const config = makeConfig(["A", "B", "C"], [[1, 2]]);

    const result = removePageFromSequence(config, 2, 2);

    expect(result.pages.map((page) => page.characterName)).toEqual(["A", "B"]);
    expect(result.comparisons).toEqual([]);
    expect(result.activePageIndex).toBe(1);
  });

  it("删除当前页之前的页面时同步当前页索引", () => {
    const config = makeConfig(["A", "B", "C"], []);

    const result = removePageFromSequence(config, 2, 0);

    expect(result.pages.map((page) => page.characterName)).toEqual(["B", "C"]);
    expect(result.activePageIndex).toBe(1);
  });

  it("单页时拒绝删除并保留原引用", () => {
    const config = makeConfig(["A"], []);

    const result = removePageFromSequence(config, 0, 0);

    expect(result.pages).toBe(config.pages);
    expect(result.comparisons).toBe(config.comparisons);
    expect(result.activePageIndex).toBe(0);
  });
});
