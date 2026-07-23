"use client";

import React, { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Copy,
  GripVertical,
  Link2,
  Plus,
  Trash2,
  Unlink2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  buildPageSequence,
  type PageSequenceItem,
} from "@/lib/page-sequence";
import type { MultiPageConfig } from "@/types/radar";

/** 本组件内共享的翻译函数类型（namespace "editor.sequence"）。 */
type SequenceT = ReturnType<typeof useTranslations>;

type PageSequenceEditorProps = {
  config: MultiPageConfig;
  pageIds?: readonly string[];
  activePageIndex: number;
  onSetActive: (index: number) => void;
  onAddPage: () => void;
  onDuplicatePage: (index: number) => void;
  onRemovePage: (index: number) => void;
  onReorderPageSequence: (activeId: string, overId: string) => void;
  onToggleComparison: (firstIndex: number, secondIndex: number) => void;
};

type ComparisonAction = {
  label: string;
  visibleLabel: string;
  disabled: boolean;
  active: boolean;
  onClick: () => void;
};

function pageName(
  config: MultiPageConfig,
  pageIndex: number,
  t: SequenceT,
): string {
  return (
    config.pages[pageIndex]?.characterName ||
    t("pageFallback", { n: pageIndex + 1 })
  );
}

function itemDescription(
  item: PageSequenceItem,
  config: MultiPageConfig,
  t: SequenceT,
): string {
  if (item.type === "page") {
    return t("itemPage", { name: pageName(config, item.pageIndices[0], t) });
  }
  return t("itemComparison", {
    a: pageName(config, item.pageIndices[0], t),
    b: pageName(config, item.pageIndices[1], t),
  });
}

function findComparisonForPage(
  config: MultiPageConfig,
  pageIndex: number,
) {
  return config.comparisons.find(
    (comparison) =>
      comparison.firstPageIndex === pageIndex ||
      comparison.secondPageIndex === pageIndex,
  );
}

type PageBarProps = {
  config: MultiPageConfig;
  pageIndex: number;
  active: boolean;
  comparisonAction: ComparisonAction;
  dragLabel: string;
  dragAttributes: ReturnType<typeof useSortable>["attributes"];
  dragListeners: ReturnType<typeof useSortable>["listeners"];
  dragHandleRef?: (element: HTMLElement | null) => void;
  canRemove: boolean;
  onSetActive: (index: number) => void;
  onDuplicatePage: (index: number) => void;
  onRequestRemove: (index: number) => void;
};

function PageBar({
  config,
  pageIndex,
  active,
  comparisonAction,
  dragLabel,
  dragAttributes,
  dragListeners,
  dragHandleRef,
  canRemove,
  onSetActive,
  onDuplicatePage,
  onRequestRemove,
}: PageBarProps) {
  const t = useTranslations("editor.sequence");
  const name = pageName(config, pageIndex, t);
  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-unfocused-border-color bg-card text-foreground hover:border-muted-foreground/50"
      }`}
    >
      <button
        ref={dragHandleRef}
        type="button"
        aria-label={dragLabel}
        className="touch-none cursor-grab rounded p-1 text-current opacity-60 hover:bg-muted/40 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        {...dragAttributes}
        {...dragListeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={t("selectPage", { name })}
        aria-current={active ? "true" : undefined}
        onClick={() => onSetActive(pageIndex)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="w-6 shrink-0 text-[11px] tabular-nums opacity-60">
          {String(pageIndex + 1).padStart(2, "0")}
        </span>
        <span className="truncate text-xs font-medium">{name}</span>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label={t("duplicateName", { name })}
          title={t("duplicateName", { name })}
          onClick={(event) => {
            event.stopPropagation();
            onDuplicatePage(pageIndex);
          }}
          className="px-1.5"
        >
          <Copy />
          <span className="hidden xl:inline">{t("duplicate")}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label={t("deleteName", { name })}
          title={t("deleteName", { name })}
          disabled={!canRemove}
          onClick={(event) => {
            event.stopPropagation();
            onRequestRemove(pageIndex);
          }}
          className="px-1.5 text-destructive hover:text-destructive"
        >
          <Trash2 />
          <span className="hidden xl:inline">{t("delete")}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label={comparisonAction.label}
          title={comparisonAction.label}
          disabled={comparisonAction.disabled}
          onClick={(event) => {
            event.stopPropagation();
            comparisonAction.onClick();
          }}
          className={`px-1.5 ${comparisonAction.active ? "text-amber-600 dark:text-amber-400" : ""}`}
        >
          {comparisonAction.active ? <Unlink2 /> : <Link2 />}
          <span className="hidden xl:inline">{comparisonAction.visibleLabel}</span>
        </Button>
      </div>
    </div>
  );
}

type SortableSequenceItemProps = {
  item: PageSequenceItem;
  itemIndex: number;
  allItems: PageSequenceItem[];
  config: MultiPageConfig;
  activePageIndex: number;
  onSetActive: (index: number) => void;
  onDuplicatePage: (index: number) => void;
  onRequestRemove: (index: number) => void;
  onToggleComparison: (firstIndex: number, secondIndex: number) => void;
};

function SortableSequenceItem({
  item,
  itemIndex,
  allItems,
  config,
  activePageIndex,
  onSetActive,
  onDuplicatePage,
  onRequestRemove,
  onToggleComparison,
}: SortableSequenceItemProps) {
  const t = useTranslations("editor.sequence");
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  // 拖拽项原位跟随光标（无 DragOverlay）：轻微放大 + 阴影表达"浮起"，宽度与颜色
  // 天然等于真实 PageBar，避免松手时的尺寸/配色跳变。
  const style: React.CSSProperties = {
    transform: transform
      ? `${CSS.Transform.toString({ ...transform, scaleX: 1, scaleY: 1 })}${
          isDragging ? " scale(1.02)" : ""
        }`
      : undefined,
    transition,
    zIndex: isDragging ? 10 : undefined,
    boxShadow: isDragging
      ? "0 8px 24px rgba(0, 0, 0, 0.18)"
      : undefined,
    borderRadius: isDragging ? "0.5rem" : undefined,
    cursor: isDragging ? "grabbing" : undefined,
  };
  const canRemove = config.pages.length > 1;

  if (item.type === "comparison") {
    const [firstPageIndex, secondPageIndex] = item.pageIndices;
    const firstName = pageName(config, firstPageIndex, t);
    const secondName = pageName(config, secondPageIndex, t);
    const dragLabel = t("dragComparison", { a: firstName, b: secondName });
    return (
      <div
        ref={setNodeRef}
        style={style}
        role="group"
        aria-label={t("comparisonGroupAria", { a: firstName, b: secondName })}
        className="rounded-lg border border-amber-500/60 bg-amber-500/10 p-1 shadow-[inset_3px_0_0_rgba(245,158,11,0.8)]"
      >
        <PageBar
          config={config}
          pageIndex={firstPageIndex}
          active={activePageIndex === firstPageIndex}
          dragLabel={dragLabel}
          dragAttributes={attributes}
          dragListeners={listeners}
          dragHandleRef={setActivatorNodeRef}
          canRemove={canRemove}
          onSetActive={onSetActive}
          onDuplicatePage={onDuplicatePage}
          onRequestRemove={onRequestRemove}
          comparisonAction={{
            label: t("unbindCompareLabel", { a: firstName, b: secondName }),
            visibleLabel: t("unbindCompare"),
            disabled: false,
            active: true,
            onClick: () => onToggleComparison(firstPageIndex, secondPageIndex),
          }}
        />
        <div className="flex h-5 items-center gap-1.5 pl-10 text-[10px] font-medium text-amber-700 dark:text-amber-300">
          <Link2 className="h-3 w-3" />
          <span>{t("comparisonBound")}</span>
        </div>
        <PageBar
          config={config}
          pageIndex={secondPageIndex}
          active={activePageIndex === secondPageIndex}
          dragLabel={dragLabel}
          dragAttributes={attributes}
          dragListeners={listeners}
          canRemove={canRemove}
          onSetActive={onSetActive}
          onDuplicatePage={onDuplicatePage}
          onRequestRemove={onRequestRemove}
          comparisonAction={{
            label: t("alreadyCompared", { name: secondName }),
            visibleLabel: t("compareNext"),
            disabled: true,
            active: false,
            onClick: () => undefined,
          }}
        />
      </div>
    );
  }

  const pageIndex = item.pageIndices[0];
  const name = pageName(config, pageIndex, t);
  const nextItem = allItems[itemIndex + 1];
  const nextPageIndex = nextItem?.type === "page" ? nextItem.pageIndices[0] : null;
  const canCompare = nextPageIndex === pageIndex + 1;
  const compareLabel = canCompare
    ? t("setCompareLabel", { a: name, b: pageName(config, nextPageIndex, t) })
    : pageIndex === config.pages.length - 1
      ? t("noNextPage", { name })
      : t("cannotCompareNext", { name });

  return (
    <div ref={setNodeRef} style={style}>
      <PageBar
        config={config}
        pageIndex={pageIndex}
        active={activePageIndex === pageIndex}
        dragLabel={t("dragPage", { name })}
        dragAttributes={attributes}
        dragListeners={listeners}
        dragHandleRef={setActivatorNodeRef}
        canRemove={canRemove}
        onSetActive={onSetActive}
        onDuplicatePage={onDuplicatePage}
        onRequestRemove={onRequestRemove}
        comparisonAction={{
          label: compareLabel,
          visibleLabel: t("compareNext"),
          disabled: !canCompare,
          active: false,
          onClick: () => {
            if (nextPageIndex !== null) {
              onToggleComparison(pageIndex, nextPageIndex);
            }
          },
        }}
      />
    </div>
  );
}

export const PageSequenceEditor: React.FC<PageSequenceEditorProps> = ({
  config,
  pageIds,
  activePageIndex,
  onSetActive,
  onAddPage,
  onDuplicatePage,
  onRemovePage,
  onReorderPageSequence,
  onToggleComparison,
}) => {
  const t = useTranslations("editor.sequence");
  const items = useMemo(
    () => buildPageSequence(config, pageIds),
    [config, pageIds],
  );
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(
    null,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const pendingComparison =
    pendingDeleteIndex === null
      ? undefined
      : findComparisonForPage(config, pendingDeleteIndex);

  const requestRemove = (pageIndex: number) => {
    if (findComparisonForPage(config, pageIndex)) {
      setPendingDeleteIndex(pageIndex);
      return;
    }
    onRemovePage(pageIndex);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorderPageSequence(String(active.id), String(over.id));
  };

  return (
    <section aria-labelledby="page-sequence-heading" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 id="page-sequence-heading" className="text-xs font-semibold text-foreground">
            {t("heading")}
          </h4>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAddPage}>
          <Plus />
          {t("addPage")}
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements: {
            onDragStart({ active }) {
              const item = items.find((candidate) => candidate.id === active.id);
              return item
                ? t("announceGrab", { desc: itemDescription(item, config, t) })
                : t("announceDragStart");
            },
            onDragOver({ over }) {
              const item = items.find((candidate) => candidate.id === over?.id);
              return item
                ? t("announceOver", { desc: itemDescription(item, config, t) })
                : undefined;
            },
            onDragEnd({ active, over }) {
              const source = items.find((candidate) => candidate.id === active.id);
              const target = items.find((candidate) => candidate.id === over?.id);
              return source && target
                ? t("announceDropped", {
                    source: itemDescription(source, config, t),
                    target: itemDescription(target, config, t),
                  })
                : t("announceDragEnd");
            },
            onDragCancel() {
              return t("announceCancel");
            },
          },
        }}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            {items.map((item, itemIndex) => (
              <SortableSequenceItem
                key={item.id}
                item={item}
                itemIndex={itemIndex}
                allItems={items}
                config={config}
                activePageIndex={activePageIndex}
                onSetActive={onSetActive}
                onDuplicatePage={onDuplicatePage}
                onRequestRemove={requestRemove}
                onToggleComparison={onToggleComparison}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <ConfirmDialog
        open={pendingDeleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteIndex(null);
        }}
        title={
          pendingDeleteIndex === null
            ? t("deleteTitle")
            : t("deleteTitleNamed", { name: pageName(config, pendingDeleteIndex, t) })
        }
        description={
          pendingDeleteIndex === null || !pendingComparison
            ? t("deleteDescSimple")
            : t("deleteDescComparison", {
                a: pageName(config, pendingComparison.firstPageIndex, t),
                b: pageName(config, pendingComparison.secondPageIndex, t),
              })
        }
        confirmLabel={t("confirmDelete")}
        danger
        onConfirm={() => {
          if (pendingDeleteIndex !== null) {
            onRemovePage(pendingDeleteIndex);
          }
        }}
      />
    </section>
  );
};
