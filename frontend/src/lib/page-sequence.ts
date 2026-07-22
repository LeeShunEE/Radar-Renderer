import type { MultiPageConfig, RadarVideoProps } from "@/types/radar";

export type PageSequenceItem =
  | { id: `page:${number}`; type: "page"; pageIndices: [number] }
  | {
      id: `comparison:${number}:${number}`;
      type: "comparison";
      pageIndices: [number, number];
    };

export type PageSequenceResult = Pick<
  MultiPageConfig,
  "pages" | "comparisons"
> & { activePageIndex: number };

type SequenceConfig = Pick<MultiPageConfig, "pages" | "comparisons">;

function unchangedResult(
  config: SequenceConfig,
  activePageIndex: number,
): PageSequenceResult {
  return {
    pages: config.pages,
    comparisons: config.comparisons,
    activePageIndex,
  };
}

export function buildPageSequence(config: SequenceConfig): PageSequenceItem[] {
  const comparisonByFirst = new Map(
    config.comparisons.map((comparison) => [
      comparison.firstPageIndex,
      comparison,
    ]),
  );
  const items: PageSequenceItem[] = [];

  for (let pageIndex = 0; pageIndex < config.pages.length; pageIndex += 1) {
    const comparison = comparisonByFirst.get(pageIndex);
    if (
      comparison?.secondPageIndex === pageIndex + 1 &&
      comparison.secondPageIndex < config.pages.length
    ) {
      items.push({
        id: `comparison:${pageIndex}:${comparison.secondPageIndex}`,
        type: "comparison",
        pageIndices: [pageIndex, comparison.secondPageIndex],
      });
      pageIndex += 1;
      continue;
    }

    items.push({
      id: `page:${pageIndex}`,
      type: "page",
      pageIndices: [pageIndex],
    });
  }

  return items;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const moved = [...items];
  const [item] = moved.splice(fromIndex, 1);
  moved.splice(toIndex, 0, item);
  return moved;
}

export function reorderPageSequence(
  config: SequenceConfig,
  activePageIndex: number,
  activeId: string,
  overId: string,
): PageSequenceResult {
  const items = buildPageSequence(config);
  const fromIndex = items.findIndex((item) => item.id === activeId);
  const toIndex = items.findIndex((item) => item.id === overId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return unchangedResult(config, activePageIndex);
  }

  const oldIndicesInNewOrder = moveItem(items, fromIndex, toIndex).flatMap(
    (item) => item.pageIndices,
  );
  const oldToNewIndex = new Map<number, number>(
    oldIndicesInNewOrder.map((oldIndex, newIndex) => [oldIndex, newIndex]),
  );
  const pages = oldIndicesInNewOrder.map((oldIndex) => config.pages[oldIndex]);
  const comparisons = config.comparisons
    .map((comparison) => ({
      ...comparison,
      firstPageIndex:
        oldToNewIndex.get(comparison.firstPageIndex) ??
        comparison.firstPageIndex,
      secondPageIndex:
        oldToNewIndex.get(comparison.secondPageIndex) ??
        comparison.secondPageIndex,
    }))
    .sort((left, right) => left.firstPageIndex - right.firstPageIndex);

  return {
    pages,
    comparisons,
    activePageIndex:
      oldToNewIndex.get(activePageIndex) ?? activePageIndex,
  };
}

function clonePage(page: RadarVideoProps): RadarVideoProps {
  return JSON.parse(JSON.stringify(page)) as RadarVideoProps;
}

export function duplicatePageInSequence(
  config: SequenceConfig,
  pageIndex: number,
): Pick<MultiPageConfig, "pages" | "comparisons"> & {
  insertedPageIndex: number;
} {
  const source = config.pages[pageIndex];
  if (!source) {
    return {
      pages: config.pages,
      comparisons: config.comparisons,
      insertedPageIndex: pageIndex,
    };
  }

  const containingItem = buildPageSequence(config).find((item) =>
    item.pageIndices.includes(pageIndex),
  );
  const insertedPageIndex = containingItem
    ? Math.max(...containingItem.pageIndices) + 1
    : pageIndex + 1;
  const duplicate = clonePage(source);
  duplicate.characterName = `${duplicate.characterName} (副本)`;
  const pages = [...config.pages];
  pages.splice(insertedPageIndex, 0, duplicate);
  const comparisons = config.comparisons.map((comparison) => ({
    ...comparison,
    firstPageIndex:
      comparison.firstPageIndex >= insertedPageIndex
        ? comparison.firstPageIndex + 1
        : comparison.firstPageIndex,
    secondPageIndex:
      comparison.secondPageIndex >= insertedPageIndex
        ? comparison.secondPageIndex + 1
        : comparison.secondPageIndex,
  }));

  return { pages, comparisons, insertedPageIndex };
}

export function removePageFromSequence(
  config: SequenceConfig,
  activePageIndex: number,
  pageIndex: number,
): PageSequenceResult {
  if (
    config.pages.length <= 1 ||
    pageIndex < 0 ||
    pageIndex >= config.pages.length
  ) {
    return unchangedResult(config, activePageIndex);
  }

  const pages = config.pages.filter((_, index) => index !== pageIndex);
  const comparisons = config.comparisons
    .filter(
      (comparison) =>
        comparison.firstPageIndex !== pageIndex &&
        comparison.secondPageIndex !== pageIndex,
    )
    .map((comparison) => ({
      ...comparison,
      firstPageIndex:
        comparison.firstPageIndex > pageIndex
          ? comparison.firstPageIndex - 1
          : comparison.firstPageIndex,
      secondPageIndex:
        comparison.secondPageIndex > pageIndex
          ? comparison.secondPageIndex - 1
          : comparison.secondPageIndex,
    }));

  const nextActivePageIndex =
    activePageIndex === pageIndex
      ? Math.min(pageIndex, pages.length - 1)
      : activePageIndex > pageIndex
        ? activePageIndex - 1
        : activePageIndex;

  return {
    pages,
    comparisons,
    activePageIndex: nextActivePageIndex,
  };
}
