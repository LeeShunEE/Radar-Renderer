"use client";

import React from "react";
import { Popover } from "@base-ui/react/popover";

export type ImportSource = { index: number; label: string };

type Props = {
  sources: ImportSource[];
  onPick: (sourceIndex: number) => void;
  triggerLabel?: string;
};

export const ImportFromMenu: React.FC<Props> = ({
  sources,
  onPick,
  triggerLabel = "从某一页面导入",
}) => {
  if (sources.length === 0) return null;
  return (
    <Popover.Root>
      <Popover.Trigger
        className="text-[11px] px-1.5 py-0.5 rounded border border-unfocused-border-color text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {triggerLabel} ▾
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} align="end">
          <Popover.Popup className="rounded-md border border-unfocused-border-color bg-card shadow-lg z-50 py-1 min-w-[160px] max-h-[260px] overflow-y-auto">
            {sources.map((s) => (
              <Popover.Close
                key={s.index}
                onClick={() => onPick(s.index)}
                className="block w-full text-left text-xs px-3 py-1.5 text-foreground hover:bg-muted"
              >
                <span className="text-muted-foreground mr-2">
                  #{s.index + 1}
                </span>
                {s.label || `页${s.index + 1}`}
              </Popover.Close>
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
