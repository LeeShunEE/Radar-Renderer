"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";

type FocusOpts = {
  pageIndex?: number;
  comparisonIndex?: number;
};

type FieldFocusContextValue = {
  focus: (ids: string[], opts?: FocusOpts) => void;
};

const HIGHLIGHT_DURATION_MS = 1500;
const HIGHLIGHT_CLASSES = [
  "ring-2",
  "ring-primary",
  "ring-offset-2",
  "ring-offset-card",
  "rounded",
  "transition-shadow",
];

const FieldFocusContext = createContext<FieldFocusContextValue | null>(null);

type ProviderProps = {
  children: React.ReactNode;
  setActivePageIndex: (index: number) => void;
  setPageExpanded: (index: number, expanded: boolean) => void;
  setActiveTab?: (tab: string) => void;
};

function tabForFieldId(id: string): string | null {
  if (id.startsWith("comparison:")) return "comparison";
  if (id.startsWith("page:")) return "pages";
  return null;
}

export const FieldFocusProvider: React.FC<ProviderProps> = ({
  children,
  setActivePageIndex,
  setPageExpanded,
  setActiveTab,
}) => {
  const timersRef = useRef<Map<string, number>>(new Map());

  const clearHighlight = useCallback((id: string) => {
    document
      .querySelectorAll<HTMLElement>(`[data-field-id="${CSS.escape(id)}"]`)
      .forEach((el) => el.classList.remove(...HIGHLIGHT_CLASSES));
    timersRef.current.delete(id);
  }, []);

  const applyHighlight = useCallback(
    (id: string) => {
      const els = document.querySelectorAll<HTMLElement>(
        `[data-field-id="${CSS.escape(id)}"]`,
      );
      if (!els.length) return;
      els.forEach((el) => el.classList.add(...HIGHLIGHT_CLASSES));
      const existing = timersRef.current.get(id);
      if (existing) window.clearTimeout(existing);
      const handle = window.setTimeout(
        () => clearHighlight(id),
        HIGHLIGHT_DURATION_MS,
      );
      timersRef.current.set(id, handle);
    },
    [clearHighlight],
  );

  const focus = useCallback(
    (ids: string[], opts?: FocusOpts) => {
      if (opts?.pageIndex !== undefined) {
        setActivePageIndex(opts.pageIndex);
        setPageExpanded(opts.pageIndex, true);
      }
      if (setActiveTab && ids.length) {
        const tab = tabForFieldId(ids[0]);
        if (tab) setActiveTab(tab);
      }
      // Wait two frames: one for state flush, one for layout (expanded panel).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          ids.forEach(applyHighlight);
          if (ids.length) {
            const first = document.querySelector<HTMLElement>(
              `[data-field-id="${CSS.escape(ids[0])}"]`,
            );
            first?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        });
      });
    },
    [applyHighlight, setActivePageIndex, setPageExpanded, setActiveTab],
  );

  const value = useMemo<FieldFocusContextValue>(() => ({ focus }), [focus]);

  return (
    <FieldFocusContext.Provider value={value}>
      {children}
    </FieldFocusContext.Provider>
  );
};

export function useFieldFocus(): FieldFocusContextValue {
  const ctx = useContext(FieldFocusContext);
  if (!ctx) {
    return { focus: () => {} };
  }
  return ctx;
}
