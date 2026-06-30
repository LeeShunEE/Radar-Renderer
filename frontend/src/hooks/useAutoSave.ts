"use client";

import { useCallback } from "react";
import type { MultiPageConfig } from "../types/radar";

const STORAGE_KEY = "radar-editor-auto-save";

type AutoSaveEntry = {
  config: MultiPageConfig;
  savedAt: string;
  title: string;
};

function generateTitle(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `自动保存 - ${year}-${month}-${day} ${hour}:${minute}`;
}

function readEntry(): AutoSaveEntry | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AutoSaveEntry;
  } catch {
    return null;
  }
}

function writeEntry(entry: AutoSaveEntry): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}

export function useAutoSave() {
  const saveAuto = useCallback((config: MultiPageConfig): boolean => {
    const entry: AutoSaveEntry = {
      config,
      savedAt: new Date().toISOString(),
      title: generateTitle(),
    };
    return writeEntry(entry);
  }, []);

  const loadAuto = useCallback((): MultiPageConfig | null => {
    const entry = readEntry();
    return entry?.config ?? null;
  }, []);

  const clearAuto = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getAutoSaveInfo = useCallback((): { title: string; savedAt: string } | null => {
    const entry = readEntry();
    if (!entry) return null;
    return { title: entry.title, savedAt: entry.savedAt };
  }, []);

  return { saveAuto, loadAuto, clearAuto, getAutoSaveInfo };
}