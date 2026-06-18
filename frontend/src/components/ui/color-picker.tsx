"use client";

import React from "react";
import { Popover } from "@base-ui/react/popover";
import { RgbaColorPicker } from "react-colorful";

type RgbaColor = { r: number; g: number; b: number; a: number };

function parseColor(input: string): RgbaColor {
  if (!input) return { r: 0, g: 0, b: 0, a: 1 };
  if (input.startsWith("rgb")) {
    const m = input.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(",").map((s) => s.trim());
      return {
        r: Math.max(0, Math.min(255, parseInt(parts[0]) || 0)),
        g: Math.max(0, Math.min(255, parseInt(parts[1]) || 0)),
        b: Math.max(0, Math.min(255, parseInt(parts[2]) || 0)),
        a:
          parts[3] !== undefined
            ? Math.max(0, Math.min(1, parseFloat(parts[3])))
            : 1,
      };
    }
  }
  if (input.startsWith("#")) {
    const hex = input.slice(1);
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16) || 0,
        g: parseInt(hex.slice(2, 4), 16) || 0,
        b: parseInt(hex.slice(4, 6), 16) || 0,
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

function formatRgba({ r, g, b, a }: RgbaColor): string {
  const alpha = a >= 0.995 ? 1 : Math.round(a * 100) / 100;
  return `rgba(${r},${g},${b},${alpha})`;
}

const CHECKER_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%)",
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
};

type ColorPickerProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  className,
}) => {
  const color = parseColor(value);
  const hasEyeDropper =
    typeof window !== "undefined" && "EyeDropper" in window;
  return (
    <Popover.Root>
      <Popover.Trigger
        className={`h-8 w-8 shrink-0 rounded border border-unfocused-border-color cursor-pointer relative overflow-hidden ${className ?? ""}`}
        aria-label="选择颜色"
      >
        <span className="absolute inset-0" style={CHECKER_STYLE} />
        <span
          className="absolute inset-0"
          style={{ background: formatRgba(color) }}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6}>
          <Popover.Popup className="rounded-lg border border-unfocused-border-color bg-card p-3 shadow-lg z-50 space-y-2">
            <RgbaColorPicker
              color={color}
              onChange={(c) => onChange(formatRgba(c))}
            />
            <div className="flex items-center gap-1">
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1 min-w-0 text-xs font-mono px-2 py-1 rounded border border-unfocused-border-color bg-background text-foreground"
              />
              {hasEyeDropper && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      // EyeDropper API 尚未进入 TS lib 类型，按实际形态声明构造器签名。
                      type EyeDropperCtor = new () => {
                        open: () => Promise<{ sRGBHex: string }>;
                      };
                      const ED = (window as unknown as { EyeDropper?: EyeDropperCtor })
                        .EyeDropper;
                      if (!ED) return;
                      const result = await new ED().open();
                      const picked = parseColor(result.sRGBHex);
                      onChange(formatRgba({ ...picked, a: color.a }));
                    } catch {
                      /* user canceled */
                    }
                  }}
                  title="屏幕取色"
                  className="shrink-0 h-7 w-7 flex items-center justify-center rounded border border-unfocused-border-color text-subtitle hover:text-foreground hover:bg-muted"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m2 22 1-1h3l9-9" />
                    <path d="M3 21v-3l9-9" />
                    <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
                  </svg>
                </button>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
