"use client";

import { useState, useEffect, useCallback } from "react";
import { MultiPageSchema, type MultiPageConfig } from "../types/radar";

const STORAGE_KEY = "radar-editor-saved-configs";

type SavedEntry = {
  name: string;
  config: MultiPageConfig;
  savedAt: string;
};

type SavedMap = Record<string, SavedEntry>;

function readMap(): SavedMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SavedMap;
  } catch {
    return {};
  }
}

function writeMap(map: SavedMap): void {
  const json = JSON.stringify(map);
  localStorage.setItem(STORAGE_KEY, json);
}

export function useSavedConfigs() {
  const [savedNames, setSavedNames] = useState<string[]>([]);

  useEffect(() => {
    const map = readMap();
    const names = Object.values(map)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      .map((e) => e.name);
    setSavedNames(names);
  }, []);

  const refresh = useCallback(() => {
    const map = readMap();
    const names = Object.values(map)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      .map((e) => e.name);
    setSavedNames(names);
  }, []);

  const saveConfig = useCallback(
    (name: string, config: MultiPageConfig): { ok: true } | { ok: false; error: string } => {
      if (!name.trim()) return { ok: false, error: "名称不能为空" };
      const map = readMap();
      map[name] = { name, config, savedAt: new Date().toISOString() };
      try {
        writeMap(map);
      } catch {
        return { ok: false, error: "保存失败：存储空间不足" };
      }
      refresh();
      return { ok: true };
    },
    [refresh],
  );

  const loadConfig = useCallback((name: string): MultiPageConfig | null => {
    const map = readMap();
    const raw = map[name]?.config;
    if (!raw) return null;
    const parsed = MultiPageSchema.safeParse(raw);
    return parsed.success ? parsed.data : (raw as MultiPageConfig);
  }, []);

  const deleteConfig = useCallback(
    (name: string) => {
      const map = readMap();
      delete map[name];
      writeMap(map);
      refresh();
    },
    [refresh],
  );

  const hasName = useCallback((name: string): boolean => {
    const map = readMap();
    return name in map;
  }, []);

  return { savedNames, saveConfig, loadConfig, deleteConfig, hasName };
}
