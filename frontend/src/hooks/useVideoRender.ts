"use client";

import { useState } from "react";
import type { RadarVideoProps, MultiPageConfig } from "../types/radar";
import { applyGlobalOverride } from "../lib/global-override";

export function useVideoRender() {
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startRender = async (
    codec: "h264" | "gif",
    renderMode: "single" | "multi",
    props: RadarVideoProps,
    config: MultiPageConfig,
  ) => {
    setRendering(true);
    setError(null);

    try {
      const mergedSingle = applyGlobalOverride(props, config.globalOverride);
      const body =
        renderMode === "multi"
          ? { mode: "multi", inputProps: { config }, codec }
          : { mode: "single", inputProps: mergedSingle, codec };

      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "渲染失败");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const ext = codec === "h264" ? "mp4" : "gif";
      const filename =
        renderMode === "multi"
          ? `radar-multi-page.${ext}`
          : `${props.characterName || "radar"}.${ext}`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
    } catch (err: any) {
      setError(err.message || "渲染出错");
    } finally {
      setRendering(false);
    }
  };

  return { rendering, error, startRender };
}
