"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Popover } from "@base-ui/react/popover";
import { Input } from "../ui/input";
import { CURATED_FONTS } from "../../lib/fonts";
import type { FontConfig } from "../../types/radar";

type FontFamilyEditorProps = {
  font: FontConfig;
  onChange: (font: FontConfig) => void;
  importMenu?: React.ReactNode;
};

const fields: { key: keyof FontConfig; labelKey: string }[] = [
  { key: "characterNameFamily", labelKey: "characterName" },
  { key: "attributeLabelFamily", labelKey: "attributeLabel" },
  { key: "ratingLabelFamily", labelKey: "ratingLabel" },
  { key: "valuePopupFamily", labelKey: "valuePopup" },
];

type FontOption = { name: string; label: string };

export function FontSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("editor.fontFamily");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allFonts = useMemo(() => {
    const curatedNames = new Set(CURATED_FONTS.map((f) => f.name));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ALL_FONTS } = require("../../lib/font-list") as {
      ALL_FONTS: { module: string; name: string }[];
    };
    return ALL_FONTS.filter((f) => !curatedNames.has(f.name)).map((f) => ({
      name: f.name,
      label: f.name,
    }));
  }, []);

  const filteredCurated = useMemo(() => {
    if (!query) return CURATED_FONTS;
    const q = query.toLowerCase();
    return CURATED_FONTS.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.label.toLowerCase().includes(q),
    );
  }, [query]);

  const filteredAll = useMemo(() => {
    if (!query) return allFonts.slice(0, 100);
    const q = query.toLowerCase();
    return allFonts.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 100);
  }, [query, allFonts]);

  const displayValue =
    CURATED_FONTS.find((f) => f.name === value)?.label ?? value;

  const handleSelect = useCallback(
    (name: string) => {
      onChange(name);
      setOpen(false);
      setQuery("");
    },
    [onChange],
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="flex h-7 w-full items-center justify-between gap-1 rounded-md border border-input bg-transparent px-2 text-xs outline-none hover:bg-muted/50 focus:border-ring focus:ring-2 focus:ring-ring/30 dark:bg-input/30"
      >
        <span className="truncate">{displayValue}</span>
        <span className="text-muted-foreground text-[10px]">▾</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          sideOffset={2}
          align="start"
          className="z-50"
        >
          <Popover.Popup className="w-[var(--anchor-width)] min-w-48 rounded-lg border bg-popover shadow-lg">
            <div className="p-1.5 border-b">
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search")}
                className="h-6 text-xs"
                autoFocus
              />
            </div>
            <div ref={listRef} className="max-h-56 overflow-y-auto p-0.5">
              {filteredCurated.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {t("curated")}
                  </div>
                  {filteredCurated.map((font) => (
                    <FontItem
                      key={font.name}
                      font={font}
                      selected={font.name === value}
                      onSelect={handleSelect}
                    />
                  ))}
                </>
              )}
              {filteredAll.length > 0 && (
                <>
                  <div className="px-2 py-1 mt-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {t("all")}
                  </div>
                  {filteredAll.map((font) => (
                    <FontItem
                      key={font.name}
                      font={font}
                      selected={font.name === value}
                      onSelect={handleSelect}
                    />
                  ))}
                </>
              )}
              {filteredCurated.length === 0 && filteredAll.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                  {t("notFound")}
                </div>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function FontItem({
  font,
  selected,
  onSelect,
}: {
  font: FontOption;
  selected: boolean;
  onSelect: (name: string) => void;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-accent transition-colors ${
        selected ? "bg-accent/50 font-medium" : ""
      }`}
      onClick={() => onSelect(font.name)}
    >
      <span className="truncate flex-1 text-left">{font.label}</span>
      {selected && (
        <span className="text-primary text-[10px]">✓</span>
      )}
    </button>
  );
}

export const FontFamilyEditor: React.FC<FontFamilyEditorProps> = ({
  font,
  onChange,
  importMenu,
}) => {
  const t = useTranslations("editor");
  const update = (key: keyof FontConfig, value: string) => {
    onChange({ ...font, [key]: value });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("fontFamily.title")}</h3>
        {importMenu}
      </div>
      {fields.map(({ key, labelKey }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-16 shrink-0">
            {t(`fontFields.${labelKey}`)}
          </span>
          <FontSelect
            value={font[key] as string}
            onChange={(v) => update(key, v)}
          />
        </div>
      ))}
    </div>
  );
};
