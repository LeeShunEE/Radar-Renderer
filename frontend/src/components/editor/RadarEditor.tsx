"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PreviewPanel } from "./PreviewPanel";
import { PreviewTargetSelector } from "./PreviewTargetSelector";
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
import {
  duplicatePageInSequence,
  removePageFromSequence,
  reorderPageSequence,
} from "../../lib/page-sequence";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { useAutoSave } from "../../hooks/useAutoSave";
import type { MultiPageConfig, RadarVideoProps } from "../../types/radar";
import { defaultMultiPageConfig, defaultRadarProps } from "../../types/constants";

export const RadarEditor: React.FC = () => {
  const [config, setConfig] = useState<MultiPageConfig>(defaultMultiPageConfig);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<"single" | "multi">("single");
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>({ 0: true });
  const [activeTab, setActiveTab] = useState<string>("global");
  const [autoSaveToast, setAutoSaveToast] = useState<string | null>(null);

  const { saveAuto } = useAutoSave();
  const lastSavedConfigRef = useRef<string>("");

  // 自动保存逻辑：每分钟检查 config 是否变化，有变化则保存
  useEffect(() => {
    const interval = setInterval(() => {
      const currentJson = JSON.stringify(config);
      if (currentJson !== lastSavedConfigRef.current) {
        const success = saveAuto(config);
        if (success) {
          lastSavedConfigRef.current = currentJson;
          setAutoSaveToast("已自动保存");
          setTimeout(() => setAutoSaveToast(null), 1500);
        }
      }
    }, 60000); // 1 分钟

    return () => clearInterval(interval);
  }, [config, saveAuto]);

  const setPageExpanded = useCallback((index: number, expanded: boolean) => {
    setExpandedMap((prev) => ({ ...prev, [index]: expanded }));
  }, []);

  const togglePageExpanded = useCallback((index: number) => {
    setExpandedMap((prev) => ({ ...prev, [index]: !prev[index] }));
  }, []);

  const activePage = config.pages[activePageIndex] ?? config.pages[0];

  // 为每个页面对象派生随身份稳定的 id：重排只搬运页面对象引用，id 因此跨重排
  // 保持不变，dnd-kit 才能正确 FLIP，修复"松手回弹再闪烁"。编辑/新增/复制会
  // 产生新对象引用，自然获得新 id，均不在拖拽过程中，无副作用。
  const pageIdMapRef = useRef(new WeakMap<RadarVideoProps, string>());
  const pageIdSeqRef = useRef(0);
  const pageIds = useMemo(
    () =>
      config.pages.map((page) => {
        let id = pageIdMapRef.current.get(page);
        if (!id) {
          pageIdSeqRef.current += 1;
          id = `p${pageIdSeqRef.current}`;
          pageIdMapRef.current.set(page, id);
        }
        return id;
      }),
    [config.pages],
  );

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

  const removePage = (index: number) => {
    const result = removePageFromSequence(config, activePageIndex, index);
    setConfig({
      ...config,
      pages: result.pages,
      comparisons: result.comparisons,
    });
    setActivePageIndex(result.activePageIndex);
  };

  const duplicatePage = (index: number) => {
    const result = duplicatePageInSequence(config, index);
    setConfig({
      ...config,
      pages: result.pages,
      comparisons: result.comparisons,
    });
  };

  const reorderPages = (activeId: string, overId: string) => {
    const result = reorderPageSequence(
      config,
      activePageIndex,
      activeId,
      overId,
      pageIds,
    );
    setConfig({
      ...config,
      pages: result.pages,
      comparisons: result.comparisons,
    });
    setActivePageIndex(result.activePageIndex);
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
        <PreviewTargetSelector
          pages={config.pages}
          previewMode={previewMode}
          activePageIndex={activePageIndex}
          onSelectGlobal={() => setPreviewMode("multi")}
          onSelectPage={(i) => {
            setActivePageIndex(i);
            setPreviewMode("single");
          }}
        />
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
              <TabsTrigger value="persistence" title="保存当前配置到服务器，或加载、管理历史配置">
                保存/加载
              </TabsTrigger>
              <TabsTrigger value="global" title="管理页面列表，并统一覆盖各页面共用的全局参数（背景、字体等）">
                全局
              </TabsTrigger>
              <TabsTrigger value="comparison" title="配置相邻两页之间的对比过渡动画（切换/叠加布局）">
                对比
              </TabsTrigger>
              <TabsTrigger value="values" title="以表格批量编辑各页面的属性名称与评分数值">
                数值
              </TabsTrigger>
              <TabsTrigger value="pages" title="逐页调整动画时序、特效与元素布局参数">
                动画细节
              </TabsTrigger>
              <TabsTrigger value="assets" title="管理上传的图片、视频、音乐等素材文件">
                素材
              </TabsTrigger>
              <TabsTrigger value="export" title="创建视频渲染任务并查看渲染队列进度">
                导出
              </TabsTrigger>
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
              pageIds={pageIds}
              activePageIndex={activePageIndex}
              onChange={setConfig}
              onSetActive={setActivePageIndex}
              onAddPage={addPage}
              onDuplicatePage={duplicatePage}
              onRemovePage={removePage}
              onReorderPageSequence={reorderPages}
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
              onAddPage={addPage}
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
                    previewing={previewMode === "single" && i === activePageIndex}
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
      {/* 自动保存 toast 提示 */}
      {autoSaveToast && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-md text-sm z-50"
          style={{ animation: "fadeIn 0.2s ease-out" }}
        >
          {autoSaveToast}
        </div>
      )}
    </div>
    </FieldFocusProvider>
  );
};
