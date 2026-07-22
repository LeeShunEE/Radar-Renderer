"use client";

import React, { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
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

type PageSequenceEditorProps = {
  config: MultiPageConfig;
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

function pageName(config: MultiPageConfig, pageIndex: number): string {
  return config.pages[pageIndex]?.characterName || `页面 ${pageIndex + 1}`;
}

function itemDescription(
  item: PageSequenceItem,
  config: MultiPageConfig,
): string {
  if (item.type === "page") {
    return `页面 ${pageName(config, item.pageIndices[0])}`;
  }
  return `对比组 ${pageName(config, item.pageIndices[0])} 与 ${pageName(config, item.pageIndices[1])}`;
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
  const name = pageName(config, pageIndex);
  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
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
        aria-label={`选择页面 ${name}`}
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
          aria-label={`复制 ${name}`}
          title={`复制 ${name}`}
          onClick={(event) => {
            event.stopPropagation();
            onDuplicatePage(pageIndex);
          }}
          className="px-1.5"
        >
          <Copy />
          <span className="hidden xl:inline">复制</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label={`删除 ${name}`}
          title={`删除 ${name}`}
          disabled={!canRemove}
          onClick={(event) => {
            event.stopPropagation();
            onRequestRemove(pageIndex);
          }}
          className="px-1.5 text-destructive hover:text-destructive"
        >
          <Trash2 />
          <span className="hidden xl:inline">删除</span>
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
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };
  const canRemove = config.pages.length > 1;

  if (item.type === "comparison") {
    const [firstPageIndex, secondPageIndex] = item.pageIndices;
    const firstName = pageName(config, firstPageIndex);
    const secondName = pageName(config, secondPageIndex);
    const dragLabel = `拖动对比组 ${firstName} 与 ${secondName}`;
    return (
      <div
        ref={setNodeRef}
        style={style}
        role="group"
        aria-label={`对比绑定：${firstName} 与 ${secondName}`}
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
            label: `解除 ${firstName} 与 ${secondName} 的对比`,
            visibleLabel: "解除对比",
            disabled: false,
            active: true,
            onClick: () => onToggleComparison(firstPageIndex, secondPageIndex),
          }}
        />
        <div className="flex h-5 items-center gap-1.5 pl-10 text-[10px] font-medium text-amber-700 dark:text-amber-300">
          <Link2 className="h-3 w-3" />
          <span>对比绑定 · 整组拖动</span>
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
            label: `${secondName} 已参与对比`,
            visibleLabel: "与下一页对比",
            disabled: true,
            active: false,
            onClick: () => undefined,
          }}
        />
      </div>
    );
  }

  const pageIndex = item.pageIndices[0];
  const name = pageName(config, pageIndex);
  const nextItem = allItems[itemIndex + 1];
  const nextPageIndex = nextItem?.type === "page" ? nextItem.pageIndices[0] : null;
  const canCompare = nextPageIndex === pageIndex + 1;
  const compareLabel = canCompare
    ? `将 ${name} 与 ${pageName(config, nextPageIndex)} 设为对比`
    : pageIndex === config.pages.length - 1
      ? `${name} 没有下一页`
      : `${name} 无法与下一页对比`;

  return (
    <div ref={setNodeRef} style={style}>
      <PageBar
        config={config}
        pageIndex={pageIndex}
        active={activePageIndex === pageIndex}
        dragLabel={`拖动页面 ${name}`}
        dragAttributes={attributes}
        dragListeners={listeners}
        dragHandleRef={setActivatorNodeRef}
        canRemove={canRemove}
        onSetActive={onSetActive}
        onDuplicatePage={onDuplicatePage}
        onRequestRemove={onRequestRemove}
        comparisonAction={{
          label: compareLabel,
          visibleLabel: "与下一页对比",
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

function SequenceItemPreview({
  item,
  config,
}: {
  item: PageSequenceItem;
  config: MultiPageConfig;
}) {
  if (item.type === "comparison") {
    return (
      <div className="w-[420px] rounded-lg border-2 border-amber-500 bg-card p-3 text-xs shadow-xl">
        <div className="font-semibold">
          {pageName(config, item.pageIndices[0])} + {pageName(config, item.pageIndices[1])}
        </div>
        <div className="mt-1 text-amber-600 dark:text-amber-400">整组拖动</div>
      </div>
    );
  }
  return (
    <div className="w-[420px] rounded-lg border border-primary bg-card p-3 text-xs font-semibold shadow-xl">
      {pageName(config, item.pageIndices[0])}
    </div>
  );
}

export const PageSequenceEditor: React.FC<PageSequenceEditorProps> = ({
  config,
  activePageIndex,
  onSetActive,
  onAddPage,
  onDuplicatePage,
  onRemovePage,
  onReorderPageSequence,
  onToggleComparison,
}) => {
  const items = useMemo(() => buildPageSequence(config), [config]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(
    null,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const activeItem = items.find((item) => item.id === activeId) ?? null;
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

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    onReorderPageSequence(String(active.id), String(over.id));
  };

  return (
    <section aria-labelledby="page-sequence-heading" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 id="page-sequence-heading" className="text-xs font-semibold text-foreground">
            页面编排
          </h4>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            拖动页面调整最终播放顺序
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAddPage}>
          <Plus />
          添加页面
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements: {
            onDragStart({ active }) {
              const item = items.find((candidate) => candidate.id === active.id);
              return item
                ? `已拿起${itemDescription(item, config)}`
                : "已开始拖动";
            },
            onDragOver({ over }) {
              const item = items.find((candidate) => candidate.id === over?.id);
              return item ? `当前位于${itemDescription(item, config)}` : undefined;
            },
            onDragEnd({ active, over }) {
              const source = items.find((candidate) => candidate.id === active.id);
              const target = items.find((candidate) => candidate.id === over?.id);
              return source && target
                ? `${itemDescription(source, config)}已放到${itemDescription(target, config)}的位置`
                : "拖动已结束";
            },
            onDragCancel() {
              return "已取消拖动";
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
        <DragOverlay>
          {activeItem ? (
            <SequenceItemPreview item={activeItem} config={config} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <ConfirmDialog
        open={pendingDeleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteIndex(null);
        }}
        title={
          pendingDeleteIndex === null
            ? "删除页面"
            : `删除页面 ${pageName(config, pendingDeleteIndex)}？`
        }
        description={
          pendingDeleteIndex === null || !pendingComparison
            ? "删除后无法恢复。"
            : `删除后将解除 ${pageName(config, pendingComparison.firstPageIndex)} 与 ${pageName(config, pendingComparison.secondPageIndex)} 的对比，但会保留另一页面。`
        }
        confirmLabel="确认删除"
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
