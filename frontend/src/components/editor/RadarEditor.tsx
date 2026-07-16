"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PreviewPanel } from "./PreviewPanel";
import { PreviewTargetSelector } from "./PreviewTargetSelector";
import { GlobalConfigEditor } from "./GlobalConfigEditor";
import { ComparisonConfigPanel } from "./ComparisonConfigPanel";
import { VideoOverlapConfigPanel } from "./VideoOverlapConfigPanel";
import { PageConfigPanel } from "./PageConfigPanel";
import { VideoPageConfigPanel, type VideoPageUpdate } from "./VideoPageConfigPanel";
import { RadarValuesTable } from "./RadarValuesTable";
import { ExportPanel } from "./ExportPanel";
import { ConfigPersistencePanel } from "./ConfigPersistencePanel";
import { FileManagerPanel } from "../files/FileManagerPanel";
import { TaskQueuePanel } from "../tasks/TaskQueuePanel";
import { FieldFocusProvider } from "./FieldFocusContext";
import { applyGlobalOverride } from "../../lib/global-override";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { useAutoSave } from "../../hooks/useAutoSave";
import { isVideoPage } from "../../types/radar";
import type { MultiPageConfig, PageConfig, RadarVideoProps, VideoPageConfig } from "../../types/radar";
import { defaultMultiPageConfig, defaultRadarProps, defaultVideoPage } from "../../types/constants";

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

  const updatePage = (index: number, updates: Partial<RadarVideoProps>) => {
    setConfig((prev) => {
      const target = prev.pages[index];
      if (isVideoPage(target)) return prev;
      const pages = [...prev.pages];
      let nextPage: RadarVideoProps = { ...target, ...updates };

      // Deep merge nested objects
      if (updates.theme) {
        nextPage = { ...nextPage, theme: { ...target.theme, ...updates.theme } };
      }
      if (updates.animation) {
        nextPage = { ...nextPage, animation: { ...target.animation, ...updates.animation } };
      }
      if (updates.font) {
        nextPage = { ...nextPage, font: { ...target.font, ...updates.font } };
      }
      if (updates.layout) {
        nextPage = { ...nextPage, layout: { ...target.layout, ...updates.layout } };
      }

      pages[index] = nextPage;
      return { ...prev, pages };
    });
  };

  // 视频页更新：嵌套合并 chromaKey/audio/background（参照 updatePage 的 theme/animation 合并）。
  const updateVideoPage = (index: number, updates: VideoPageUpdate) => {
    setConfig((prev) => {
      const target = prev.pages[index];
      if (!isVideoPage(target)) return prev;
      const pages = [...prev.pages];
      const { chromaKey, audio, background, ...rest } = updates;
      let nextPage: VideoPageConfig = { ...target, ...rest };
      if (chromaKey) {
        nextPage = { ...nextPage, chromaKey: { ...target.chromaKey, ...chromaKey } };
      }
      if (audio) {
        nextPage = { ...nextPage, audio: { ...target.audio, ...audio } };
      }
      if (background) {
        nextPage = { ...nextPage, background: { ...target.background, ...background } };
      }
      pages[index] = nextPage;
      return { ...prev, pages };
    });
  };

  const toggleIgnoreOverride = useCallback(
    (pageIndex: number, path: string, ignored: boolean) => {
      setConfig((prev) => {
        const target = prev.pages[pageIndex];
        if (isVideoPage(target)) return prev;
        const pages = [...prev.pages];
        pages[pageIndex] = {
          ...target,
          overrideIgnored: {
            ...(target.overrideIgnored ?? {}),
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

  const addVideoPage = () => {
    setConfig((prev) => ({
      ...prev,
      pages: [
        ...prev.pages,
        { ...defaultVideoPage, label: `视频${prev.pages.length + 1}` },
      ],
    }));
  };

  // 泛化的相邻页索引对重映射：comparisons 与 videoOverlaps 共用同一 remap，
  // 删除任一侧页面 → 该配对移除（被删索引映射为 null）；其余按 remap 平移。
  const remapIndexPairs = <T extends { firstPageIndex: number; secondPageIndex: number }>(
    pairs: T[],
    remap: (oldIndex: number) => number | null,
  ): T[] =>
    pairs.flatMap((pair) => {
      const a = remap(pair.firstPageIndex);
      const b = remap(pair.secondPageIndex);
      if (a === null || b === null || a === b) return [];
      return [{ ...pair, firstPageIndex: a, secondPageIndex: b }];
    });

  const removePage = (index: number) => {
    setConfig((prev) => {
      if (prev.pages.length <= 1) return prev;
      const pages = prev.pages.filter((_, i) => i !== index);
      const remap = (i: number) => (i === index ? null : i > index ? i - 1 : i);
      const comparisons = remapIndexPairs(prev.comparisons, remap);
      const videoOverlaps = remapIndexPairs(prev.videoOverlaps, remap);
      return { ...prev, pages, comparisons, videoOverlaps };
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
      const copy = JSON.parse(JSON.stringify(pages[index])) as PageConfig;
      if (isVideoPage(copy)) {
        copy.label = `${copy.label} (副本)`;
      } else {
        copy.characterName = `${copy.characterName} (副本)`;
      }
      pages.splice(index + 1, 0, copy);
      // 插入点 index+1：index 之后的所有索引 +1。
      const remap = (i: number) => (i > index ? i + 1 : i);
      const comparisons = remapIndexPairs(prev.comparisons, remap);
      const videoOverlaps = remapIndexPairs(prev.videoOverlaps, remap);
      return { ...prev, pages, comparisons, videoOverlaps };
    });
  };

  const movePage = (from: number, to: number) => {
    setConfig((prev) => {
      const pages = [...prev.pages];
      const [moved] = pages.splice(from, 1);
      pages.splice(to, 0, moved);
      const remap = (i: number) => {
        if (i === from) return to;
        // 移除 from 后元素前移，插入 to 后再回移；两次移位的净效果按区间分支。
        if (from < to) {
          // 区间 (from, to] 整体 -1。
          if (i > from && i <= to) return i - 1;
          return i;
        } else {
          // 区间 [to, from) 整体 +1。
          if (i >= to && i < from) return i + 1;
          return i;
        }
      };
      const comparisons = remapIndexPairs(prev.comparisons, remap);
      const videoOverlaps = remapIndexPairs(prev.videoOverlaps, remap);
      return { ...prev, pages, comparisons, videoOverlaps };
    });
    if (activePageIndex === from) {
      setActivePageIndex(to);
    } else if (activePageIndex === to) {
      setActivePageIndex(from);
    }
  };

  // 视频页单页预览走 PreviewPanel 的 videoPage 分支；
  // playerProps 仅 ExportPanel 等按雷达页消费，视频页兜底默认雷达配置避免类型/运行时错误。
  const playerProps = useMemo(
    () =>
      applyGlobalOverride(
        isVideoPage(activePage) ? defaultRadarProps : activePage,
        config.globalOverride,
      ),
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
                videoPage: isVideoPage(activePage) ? activePage : undefined,
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
              activePageIndex={activePageIndex}
              onChange={setConfig}
              onSetActive={setActivePageIndex}
              onAddPage={addPage}
              onAddVideoPage={addVideoPage}
              onDuplicatePage={duplicatePage}
              onRemovePage={removePage}
              onMovePage={movePage}
              onPreviewAll={() => setPreviewMode("multi")}
            />
          </TabsContent>

          <TabsContent value="comparison" className="overflow-y-auto p-6 space-y-4">
            <ComparisonConfigPanel config={config} onChange={setConfig} />
            <VideoOverlapConfigPanel config={config} onChange={setConfig} />
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
              if (isVideoPage(page)) {
                const activate = () => {
                  if (i !== activePageIndex) setActivePageIndex(i);
                };
                return (
                  <div key={i} data-testid={`vp-${i}`} onFocus={activate} onMouseDown={activate}>
                    <VideoPageConfigPanel
                      page={page}
                      onUpdate={(updates) => updateVideoPage(i, updates)}
                    />
                  </div>
                );
              }
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
                    allPages={config.pages.filter((p): p is RadarVideoProps => !isVideoPage(p))}
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
              activePage={activePage}
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
