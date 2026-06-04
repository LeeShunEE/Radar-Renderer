"use client";

import React, { useRef, useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useSavedConfigs } from "../../hooks/useSavedConfigs";
import { MultiPageSchema, type MultiPageConfig } from "../../types/radar";

type Props = {
  currentConfig: MultiPageConfig;
  onLoadConfig: (config: MultiPageConfig) => void;
};

export const ConfigPersistencePanel: React.FC<Props> = ({
  currentConfig,
  onLoadConfig,
}) => {
  const { savedNames, saveConfig, loadConfig, deleteConfig, hasName } =
    useSavedConfigs();

  const [saveName, setSaveName] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 1500);
  };

  const handleSave = () => {
    setError(null);
    const result = saveConfig(saveName.trim(), currentConfig);
    if (result.ok) {
      showFeedback("已保存!");
      setSelectedName(saveName.trim());
    } else {
      setError(result.error);
    }
  };

  const handleLoad = () => {
    if (!selectedName) return;
    const config = loadConfig(selectedName);
    if (config) {
      onLoadConfig(config);
      showFeedback("已加载!");
    }
  };

  const handleDelete = () => {
    if (!selectedName) return;
    if (!confirm(`确定删除配置"${selectedName}"吗？`)) return;
    deleteConfig(selectedName);
    setSelectedName("");
    showFeedback("已删除!");
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportFile = () => {
    setError(null);
    try {
      const json = JSON.stringify(currentConfig, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const baseName = saveName.trim() || selectedName || "radar-config";
      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      a.href = url;
      a.download = `${baseName}-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showFeedback("已导出文件!");
    } catch (e) {
      setError(`导出失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleImportFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = MultiPageSchema.safeParse(parsed);
      if (!result.success) {
        setError(`配置不合法：${result.error.issues[0]?.message ?? "未知错误"}`);
        return;
      }
      onLoadConfig(result.data);
      showFeedback("已从文件加载!");
    } catch (e) {
      setError(`导入失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const trimmed = saveName.trim();
  const nameExists = trimmed.length > 0 && hasName(trimmed);

  return (
    <div className="rounded-lg border border-unfocused-border-color p-3 space-y-2">
      <h3 className="text-sm font-medium text-foreground">配置存档</h3>

      {/* 保存 */}
      <div className="flex items-center gap-2">
        <Input
          value={saveName}
          onChange={(e) => {
            setSaveName(e.target.value);
            setError(null);
          }}
          placeholder="输入配置名称"
          className="h-7 text-xs"
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={trimmed.length === 0}
          className="h-7 text-xs shrink-0"
        >
          保存
        </Button>
      </div>
      {nameExists && (
        <p className="text-xs text-yellow-600">已存在同名配置，保存将覆盖</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* 加载 / 删除 */}
      <div className="flex items-center gap-2">
        <Select value={selectedName} onValueChange={(v) => setSelectedName(v ?? "")}>
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue placeholder="选择已保存配置" />
          </SelectTrigger>
          <SelectContent>
            {savedNames.length === 0 ? (
              <SelectItem value="__empty__" disabled>
                暂无保存的配置
              </SelectItem>
            ) : (
              savedNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={handleLoad}
          disabled={!selectedName}
          className="h-7 text-xs shrink-0"
        >
          加载
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDelete}
          disabled={!selectedName}
          className="h-7 text-xs shrink-0 text-red-500 hover:text-red-600"
        >
          删除
        </Button>
      </div>

      {/* 文件导入 / 导出 */}
      <div className="flex items-center gap-2 pt-1 border-t border-unfocused-border-color/40">
        <Button
          size="sm"
          variant="outline"
          onClick={handleExportFile}
          className="h-7 text-xs flex-1"
          title="将当前配置下载为 JSON 文件"
        >
          导出到文件
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="h-7 text-xs flex-1"
          title="从 JSON 文件加载配置"
        >
          从文件导入
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* 反馈 */}
      {feedback && (
        <p className="text-xs text-green-600">{feedback}</p>
      )}
    </div>
  );
};
