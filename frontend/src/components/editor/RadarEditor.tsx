"use client";

import React, { useCallback, useMemo, useState } from "react";
import { PreviewPanel } from "./PreviewPanel";
import { GlobalConfigEditor } from "./GlobalConfigEditor";
import { ComparisonConfigPanel } from "./ComparisonConfigPanel";
import { PageConfigPanel } from "./PageConfigPanel";
import { RadarValuesTable } from "./RadarValuesTable";
import { ExportPanel } from "./ExportPanel";
import { ConfigPersistencePanel } from "./ConfigPersistencePanel";
import { FileManagerPanel } from "../files/FileManagerPanel";
import { TaskQueuePanel } from "../tasks/TaskQueuePanel";
import { FieldFocusProvider } from "./FieldFocusContext";
import { applyGlobalOverride } from "../../lib/global-override";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import type { MultiPageConfig, RadarVideoProps } from "../../types/radar";
import { defaultMultiPageConfig, defaultRadarProps } from "../../types/constants";

export const RadarEditor: React.FC = () => {
  const [config, setConfig] = useState<MultiPageConfig>(defaultMultiPageConfig);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<"single" | "multi">("single");
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>({ 0: true });
  const [activeTab, setActiveTab] = useState<string>("global");

  const setPageExpanded = useCallback((index: number, expanded: boolean) => {
    setExpandedMap((prev) => ({ ...prev, [index]: expanded }));
  }, []);

  const togglePageExpanded = useCallback((index: number) => {
    setExpandedMap((prev) => ({ ...prev, [index]: !prev[index] }));
  }, []);

  const activePage = config.pages[activePageIndex] ?? config.pages[0];

  const updatePage = (index: number, updates: Partial<RadarVideoProps>) => {
    setConfig((prev) => {
      const pages = [...prev.pages];
      pages[index] = { ...pages[index], ...updates };

      // Deep merge nested objects
      if (updates.theme) {
        pages[index] = {
          ...pages[index],
          theme: { ...prev.pages[index].theme, ...updates.theme },
        };
      }
      if (updates.animation) {
        pages[index] = {
          ...pages[index],
          animation: {
            ...prev.pages[index].animation,
            ...updates.animation,
          },
        };
      }
      if (updates.font) {
        pages[index] = {
          ...pages[index],
          font: { ...prev.pages[index].font, ...updates.font },
        };
      }
      if (updates.layout) {
        pages[index] = {
          ...pages[index],
          layout: { ...prev.pages[index].layout, ...updates.layout },
        };
      }

      return { ...prev, pages };
    });
  };

  const toggleIgnoreOverride = useCallback(
    (pageIndex: number, path: string, ignored: boolean) => {
      setConfig((prev) => {
        const pages = [...prev.pages];
        pages[pageIndex] = {
          ...pages[pageIndex],
          overrideIgnored: {
            ...(pages[pageIndex].overrideIgnored ?? {}),
            [path]: ignored,
          },
        };
        return { ...prev, pages };
      });
    },
    [],
  );

  const addPage = () => {
    setConfig((prev) => ({
      ...prev,
      pages: [
        ...prev.pages,
        { ...defaultRadarProps, characterName: `角色${prev.pages.length + 1}` },
      ],
    }));
  };

  const remapComparisons = (
    comparisons: MultiPageConfig["comparisons"],
    remap: (oldIndex: number) => number | null,
  ) =>
    comparisons.flatMap((c) => {
      const a = remap(c.firstPageIndex);
      const b = remap(c.secondPageIndex);
      if (a === null || b === null || a === b) return [];
      return [{ ...c, firstPageIndex: a, secondPageIndex: b }];
    });

  const removePage = (index: number) => {
    setConfig((prev) => {
      if (prev.pages.length <= 1) return prev;
      const pages = prev.pages.filter((_, i) => i !== index);
      const comparisons = remapComparisons(prev.comparisons, (i) =>
        i === index ? null : i > index ? i - 1 : i,
      );
      return { ...prev, pages, comparisons };
    });
    setActivePageIndex((prev) => {
      if (prev >= config.pages.length - 1) {
        return Math.max(0, config.pages.length - 2);
      }
      return prev;
    });
  };

  const duplicatePage = (index: number) => {
    setConfig((prev) => {
      const pages = [...prev.pages];
      const copy = JSON.parse(JSON.stringify(pages[index])) as RadarVideoProps;
      copy.characterName = `${copy.characterName} (副本)`;
      pages.splice(index + 1, 0, copy);
      // Indices > index shift by +1 (insertion point is index+1).
      const comparisons = remapComparisons(prev.comparisons, (i) =>
        i > index ? i + 1 : i,
      );
      return { ...prev, pages, comparisons };
    });
  };

  const movePage = (from: number, to: number) => {
    setConfig((prev) => {
      const pages = [...prev.pages];
      const [moved] = pages.splice(from, 1);
      pages.splice(to, 0, moved);
      const comparisons = remapComparisons(prev.comparisons, (i) => {
        if (i === from) return to;
        // After removing `from`, items shift; after inserting at `to`, items shift back.
        if (from < to) {
          // Range (from, to] shifts down by 1.
          if (i > from && i <= to) return i - 1;
          return i;
        } else {
          // Range [to, from) shifts up by 1.
          if (i >= to && i < from) return i + 1;
          return i;
        }
      });
      return { ...prev, pages, comparisons };
    });
    if (activePageIndex === from) {
      setActivePageIndex(to);
    } else if (activePageIndex === to) {
      setActivePageIndex(from);
    }
  };

  const playerProps = useMemo(
    () => applyGlobalOverride(activePage, config.globalOverride),
    [activePage, config.globalOverride],
  );

  return (
    <FieldFocusProvider
      setActivePageIndex={setActivePageIndex}
      setPageExpanded={setPageExpanded}
      setActiveTab={setActiveTab}
    >
    <div className="flex h-[calc(100vh-52px)]">
      {/* 左侧预览 */}
      <div className="w-[45%] p-6 border-r border-unfocused-border-color overflow-y-auto">
        <PreviewPanel
          {...(previewMode === "single"
            ? {
                mode: "single" as const,
                props: playerProps,
                musicUrl: config.musicUrl,
              }
            : { mode: "multi" as const, config: config })}
        />
      </div>

      {/* 右侧配置面板 */}
      <div className="w-[55%] flex flex-col overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(String(v))}
          className="flex flex-col flex-1 min-h-0 gap-0"
        >
          <div className="px-6 pt-4 pb-2 border-b border-unfocused-border-color bg-background">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="persistence">配置</TabsTrigger>
              <TabsTrigger value="global">全局</TabsTrigger>
              <TabsTrigger value="comparison">对比</TabsTrigger>
              <TabsTrigger value="values">数值</TabsTrigger>
              <TabsTrigger value="pages">页面</TabsTrigger>
              <TabsTrigger value="assets">素材</TabsTrigger>
              <TabsTrigger value="export">导出</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="persistence" className="overflow-y-auto p-6 space-y-4">
            <ConfigPersistencePanel
              currentConfig={config}
              onLoadConfig={(loaded) => {
                setConfig(loaded);
                setActivePageIndex(0);
              }}
            />
          </TabsContent>

          <TabsContent value="global" className="overflow-y-auto p-6 space-y-4">
            <GlobalConfigEditor
              config={config}
              activePageIndex={activePageIndex}
              onChange={setConfig}
              onSetActive={setActivePageIndex}
              onAddPage={addPage}
              onDuplicatePage={duplicatePage}
              onRemovePage={removePage}
              onMovePage={movePage}
              onPreviewAll={() => setPreviewMode("multi")}
            />
          </TabsContent>

          <TabsContent value="comparison" className="overflow-y-auto p-6 space-y-4">
            <ComparisonConfigPanel config={config} onChange={setConfig} />
          </TabsContent>

          <TabsContent value="values" className="overflow-y-auto p-6 space-y-4">
            <RadarValuesTable
              config={config}
              onChange={setConfig}
              activePageIndex={activePageIndex}
              onSetActive={setActivePageIndex}
            />
          </TabsContent>

          <TabsContent value="pages" className="overflow-y-auto p-6 space-y-4">
            {config.pages.map((page, i) => {
              const isSecondary = config.comparisons?.some(
                (c) => c.secondPageIndex === i,
              );
              const activate = () => {
                if (i !== activePageIndex) setActivePageIndex(i);
              };
              return (
                <div
                  key={i}
                  onFocus={activate}
                  onMouseDown={activate}
                >
                  <PageConfigPanel
                    index={i}
                    page={page}
                    allPages={config.pages}
                    isActive={i === activePageIndex}
                    isSecondary={!!isSecondary}
                    expanded={expandedMap[i] ?? false}
                    onToggle={() => togglePageExpanded(i)}
                    onUpdate={(updates) => {
                      activate();
                      updatePage(i, updates);
                    }}
                    onPreview={() => {
                      setActivePageIndex(i);
                      setPreviewMode("single");
                    }}
                    onDuplicate={() => duplicatePage(i)}
                    onRemove={() => removePage(i)}
                    canRemove={config.pages.length > 1}
                    globalOverrideEnabled={config.globalOverride?.enabled}
                    onToggleIgnoreOverride={(path, ignored) => toggleIgnoreOverride(i, path, ignored)}
                  />
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="assets" className="overflow-y-auto p-6 space-y-4">
            <FileManagerPanel />
          </TabsContent>

          <TabsContent value="export" className="overflow-y-auto p-6 space-y-4">
            {/* 队列任务卡片 */}
            <div className="space-y-3 border border-unfocused-border-color rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground">渲染队列</h3>
              <TaskQueuePanel />
            </div>

            {/* 创建渲染任务卡片 */}
            <ExportPanel
              props={playerProps}
              config={config}
              previewMode={previewMode}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </FieldFocusProvider>
  );
};
