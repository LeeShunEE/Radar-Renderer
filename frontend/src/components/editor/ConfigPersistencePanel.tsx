"use client";

import React, { useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("editor.persistence");
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
      showFeedback(t("saved"));
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
      showFeedback(t("loaded"));
    }
  };

  const handleDelete = () => {
    if (!selectedName) return;
    if (!confirm(t("confirmDelete", { name: selectedName }))) return;
    deleteConfig(selectedName);
    setSelectedName("");
    showFeedback(t("deleted"));
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
      showFeedback(t("exportedFile"));
    } catch (e) {
      setError(t("exportFailed", { error: e instanceof Error ? e.message : String(e) }));
    }
  };

  const handleImportFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = MultiPageSchema.safeParse(parsed);
      if (!result.success) {
        setError(t("invalidConfig", { error: result.error.issues[0]?.message ?? t("unknownError") }));
        return;
      }
      onLoadConfig(result.data);
      showFeedback(t("loadedFromFile"));
    } catch (e) {
      setError(t("importFailed", { error: e instanceof Error ? e.message : String(e) }));
    }
  };

  const trimmed = saveName.trim();
  const nameExists = trimmed.length > 0 && hasName(trimmed);

  return (
    <div className="rounded-lg border border-unfocused-border-color p-3 space-y-2">
      <h3 className="text-sm font-medium text-foreground">{t("title")}</h3>

      {/* 保存 */}
      <div className="flex items-center gap-2">
        <Input
          value={saveName}
          onChange={(e) => {
            setSaveName(e.target.value);
            setError(null);
          }}
          placeholder={t("namePlaceholder")}
          className="h-7 text-xs"
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={trimmed.length === 0}
          className="h-7 text-xs shrink-0"
        >
          {t("save")}
        </Button>
      </div>
      {nameExists && (
        <p className="text-xs text-yellow-600">{t("overwriteHint")}</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* 加载 / 删除 */}
      <div className="flex items-center gap-2">
        <Select value={selectedName} onValueChange={(v) => setSelectedName(v ?? "")}>
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue placeholder={t("selectPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {savedNames.length === 0 ? (
              <SelectItem value="__empty__" disabled>
                {t("noneSaved")}
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
          {t("load")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDelete}
          disabled={!selectedName}
          className="h-7 text-xs shrink-0 text-red-500 hover:text-red-600"
        >
          {t("delete")}
        </Button>
      </div>

      {/* 文件导入 / 导出 */}
      <div className="flex items-center gap-2 pt-1 border-t border-unfocused-border-color/40">
        <Button
          size="sm"
          variant="outline"
          onClick={handleExportFile}
          className="h-7 text-xs flex-1"
          title={t("exportFileTitle")}
        >
          {t("exportFile")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="h-7 text-xs flex-1"
          title={t("importFileTitle")}
        >
          {t("importFile")}
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
