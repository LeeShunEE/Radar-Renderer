"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { useUploadObjectUrls } from "@/hooks/useUploadObjectUrls";
import {
  calculateDuration,
  calculateComparisonDuration,
  computePhaseStarts,
} from "../../types/constants";
import type { MultiPageConfig, RadarVideoProps } from "../../types/radar";
import { RadarVideo } from "../../remotion/RadarVideo";
import { MultiPageVideo } from "../../remotion/MultiPageVideo";
import { applyGlobalOverride } from "../../lib/global-override";
import { VIDEO_FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from "../../types/constants";
import { useFieldFocus } from "./FieldFocusContext";

type PreviewPanelProps =
  | { mode: "single"; props: RadarVideoProps; musicUrl?: string }
  | { mode: "multi"; config: MultiPageConfig };

type TargetID = "radar-label" | "radar-rating" | "radar-octagon" | "avatar" | "name" | "legend";

type RenderSegment = {
  targetId: TargetID;
  start: number;
  end: number;
  pageLabel: string;
  behavior: string;
  pageIndex?: number;
  comparisonIndex?: number;
  fieldIds: string[];
};

const TARGET_ORDER: TargetID[] = [
  "radar-label",
  "radar-rating",
  "radar-octagon",
  "avatar",
  "name",
  "legend",
];

const TARGET_META: Record<TargetID, { label: string; color: string }> = {
  "radar-label":   { label: "属性标签",   color: "#94a3b8" },
  "radar-rating":  { label: "评分",       color: "#f59e0b" },
  "radar-octagon": { label: "数据多边形", color: "#6366f1" },
  "avatar":        { label: "头像",       color: "#ec4899" },
  "name":          { label: "角色名称",   color: "#22d3ee" },
  "legend":        { label: "图例",       color: "#a3e635" },
};

const ROW_HEIGHT = 18;
const LANE_GAP = 1;
const GROUP_GAP = 4;
const LEFT_GUTTER = 76;
const GUTTER_TIMELINE_GAP = 6;
const MUSIC_LANE_HEIGHT = 44;
const MUSIC_GROUP_GAP = 6;
const PEAK_COUNT = 800;
const AUDIO_SYNC_THRESHOLD_SEC = 0.12;

type LaneLayout = {
  laneByIndex: Map<number, number>;
  lanesByTarget: Record<TargetID, number>;
  groupTop: Record<TargetID, number>;
  groupHeight: Record<TargetID, number>;
  totalHeight: number;
};

function computeLaneLayout(segments: RenderSegment[]): LaneLayout {
  const laneByIndex = new Map<number, number>();
  const lanesByTarget = {} as Record<TargetID, number>;
  for (const id of TARGET_ORDER) lanesByTarget[id] = 1;

  for (const id of TARGET_ORDER) {
    const indexed = segments
      .map((s, i) => ({ s, i }))
      .filter((x) => x.s.targetId === id)
      .sort((a, b) => a.s.start - b.s.start || a.s.end - b.s.end);
    const laneEnds: number[] = [];
    for (const { s, i } of indexed) {
      let lane = laneEnds.findIndex((end) => end <= s.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(s.end);
      } else {
        laneEnds[lane] = s.end;
      }
      laneByIndex.set(i, lane);
    }
    if (laneEnds.length > 0) lanesByTarget[id] = laneEnds.length;
  }

  const groupTop = {} as Record<TargetID, number>;
  const groupHeight = {} as Record<TargetID, number>;
  let y = 0;
  TARGET_ORDER.forEach((id, gi) => {
    const lanes = lanesByTarget[id];
    const h = lanes * ROW_HEIGHT + (lanes - 1) * LANE_GAP;
    groupTop[id] = y;
    groupHeight[id] = h;
    y += h;
    if (gi < TARGET_ORDER.length - 1) y += GROUP_GAP;
  });
  return { laneByIndex, lanesByTarget, groupTop, groupHeight, totalHeight: y };
}

const LABEL_FIELDS = ["animation.labelStartOffset", "animation.labelStagger"];
const FILL_OCTAGON_FIELDS = ["animation.fillDuration", "animation.fillStartOffset"];
const FILL_AVATAR_FIELDS = ["animation.silhouetteDelay", "animation.silhouetteFadeInDuration"];
const EFFECT_OCTAGON_FIELDS = [
  "animation.effectsStartOffset",
  "animation.highValueThreshold",
  "animation.highValueSpringDamping",
  "animation.highValueGlowEnabled",
  "animation.highValueGlowStyle",
];
const EFFECT_RATING_FIELDS = [
  "animation.effectsStartOffset",
  "animation.highValueThreshold",
  "animation.valuePopupEnabled",
  "animation.valuePopupStyle",
];
const NAME_FIELDS = ["animation.nameAppearRatio", "animation.nameFadeInDuration"];

const SWAP_AVATAR_FIELDS = ["swapDurationFrames", "silhouetteSwapOffset", "silhouetteFadeOutOpacity"];
const SWAP_NAME_FIELDS = ["swapDurationFrames"];
const SWAP_OCTAGON_FIELDS = ["swapDurationFrames", "polygonMode"];
const SWAP_RATING_FIELDS = [
  "diffTriangleScale",
  "dualRatingSlideFrames",
  "dualRatingFadeFrames",
];
const LEGEND_FIELDS = [
  "showLegend",
  "legendOffsetX",
  "legendOffsetY",
  "legendFontSize",
  "legendFontFamily",
  "legendDotRadius",
];

function pageFieldIds(pageIndex: number, keys: string[]): string[] {
  return keys.map((k) => `page:${pageIndex}:${k}`);
}

function compFieldIds(comparisonIndex: number, keys: string[]): string[] {
  return keys.map((k) => `comparison:${comparisonIndex}:${k}`);
}

type PushPageOptions = {
  includeLabel?: boolean;
  includeEffect?: boolean;
  includeName?: boolean;
  includeAvatar?: boolean;
  includeOctagonFill?: boolean;
};

function pushPageSegments(
  out: RenderSegment[],
  page: RadarVideoProps,
  pageLabel: string,
  baseFrame: number,
  pageIndex: number,
  opts: PushPageOptions = {},
): void {
  const {
    includeLabel = true,
    includeEffect = true,
    includeName = true,
    includeAvatar = true,
    includeOctagonFill = true,
  } = opts;
  const a = page.animation;
  const p = computePhaseStarts(a);
  const lastIdx = Math.max(0, page.attributes.length - 1);
  // AttributeLabel: appearFrame[i] = labelStart + i*stagger, 10-frame fade.
  // RatingLabel:    appearFrame[i] = labelStart + i*stagger + 5, 10-frame fade.
  const labelFadeDur = 10;
  const ratingOffset = 5;
  const labelPhaseEnd = p.labelStart + lastIdx * a.labelStagger + labelFadeDur;
  const ratingPhaseStart = p.labelStart + ratingOffset;
  const ratingPhaseEnd = p.labelStart + lastIdx * a.labelStagger + ratingOffset + labelFadeDur;

  if (includeLabel) {
    out.push({
      targetId: "radar-label",
      start: baseFrame + p.labelStart,
      end: baseFrame + labelPhaseEnd,
      pageLabel,
      behavior: "标签淡入",
      pageIndex,
      fieldIds: pageFieldIds(pageIndex, LABEL_FIELDS),
    });
    out.push({
      targetId: "radar-rating",
      start: baseFrame + ratingPhaseStart,
      end: baseFrame + ratingPhaseEnd,
      pageLabel,
      behavior: "评分淡入",
      pageIndex,
      fieldIds: pageFieldIds(pageIndex, LABEL_FIELDS),
    });
  }

  if (includeOctagonFill) {
    out.push({
      targetId: "radar-octagon",
      start: baseFrame + p.fillStart,
      end: baseFrame + p.fillEnd,
      pageLabel,
      behavior: "多边形填充",
      pageIndex,
      fieldIds: pageFieldIds(pageIndex, FILL_OCTAGON_FIELDS),
    });
  }

  if (includeAvatar) {
    const avatarStart = baseFrame + a.silhouetteDelay;
    out.push({
      targetId: "avatar",
      start: avatarStart,
      end: avatarStart + a.silhouetteFadeInDuration,
      pageLabel,
      behavior: "头像淡入",
      pageIndex,
      fieldIds: pageFieldIds(pageIndex, FILL_AVATAR_FIELDS),
    });
  }

  if (includeName) {
    const nameStart = baseFrame + p.fillStart + a.fillDuration * a.nameAppearRatio;
    out.push({
      targetId: "name",
      start: nameStart,
      end: nameStart + a.nameFadeInDuration,
      pageLabel,
      behavior: "名称淡入",
      pageIndex,
      fieldIds: pageFieldIds(pageIndex, NAME_FIELDS),
    });
  }

  if (includeEffect) {
    out.push({
      targetId: "radar-octagon",
      start: baseFrame + p.effectsStart,
      end: baseFrame + p.effectsEnd,
      pageLabel,
      behavior: "高分发光",
      pageIndex,
      fieldIds: pageFieldIds(pageIndex, EFFECT_OCTAGON_FIELDS),
    });
    out.push({
      targetId: "radar-rating",
      start: baseFrame + p.effectsStart,
      end: baseFrame + p.effectsEnd,
      pageLabel,
      behavior: "评分弹出",
      pageIndex,
      fieldIds: pageFieldIds(pageIndex, EFFECT_RATING_FIELDS),
    });
  }
}

function pushComparisonSegments(
  out: RenderSegment[],
  secondary: RadarVideoProps,
  comp: {
    swapDurationFrames: number;
    dualRatingSlideFrames: number;
    dualRatingFadeFrames: number;
  },
  comparisonIndex: number,
  comparisonStart: number,
  secondaryPageIndex: number,
  pageLabel: string,
): void {
  const a = secondary.animation;
  const swapDur = Math.max(1, comp.swapDurationFrames);
  const halfSwap = Math.floor(swapDur / 2);

  const compFields = (keys: string[]) => compFieldIds(comparisonIndex, keys);
  const pageFields = (keys: string[]) => pageFieldIds(secondaryPageIndex, keys);

  // Primary A fades out (first half of swap window).
  out.push({
    targetId: "avatar",
    start: comparisonStart,
    end: comparisonStart + halfSwap,
    pageLabel,
    behavior: "头像淡出",
    comparisonIndex,
    fieldIds: compFields(SWAP_AVATAR_FIELDS),
  });
  out.push({
    targetId: "name",
    start: comparisonStart,
    end: comparisonStart + halfSwap,
    pageLabel,
    behavior: "名称淡出",
    comparisonIndex,
    fieldIds: compFields(SWAP_NAME_FIELDS),
  });

  // Secondary B fades in (second half of swap window).
  out.push({
    targetId: "avatar",
    start: comparisonStart + halfSwap,
    end: comparisonStart + swapDur,
    pageLabel,
    behavior: "头像淡入",
    comparisonIndex,
    fieldIds: compFields(SWAP_AVATAR_FIELDS),
  });
  out.push({
    targetId: "name",
    start: comparisonStart + halfSwap,
    end: comparisonStart + swapDur,
    pageLabel,
    behavior: "名称淡入",
    comparisonIndex,
    fieldIds: compFields(SWAP_NAME_FIELDS),
  });

  // Secondary octagon: ComparisonFill animates from frame 0 of the
  // comparison layer for the full secondary fillDuration.
  out.push({
    targetId: "radar-octagon",
    start: comparisonStart,
    end: comparisonStart + a.fillDuration,
    pageLabel,
    behavior: "多边形过渡",
    pageIndex: secondaryPageIndex,
    comparisonIndex,
    fieldIds: [
      ...compFields(SWAP_OCTAGON_FIELDS),
      ...pageFields(FILL_OCTAGON_FIELDS),
    ],
  });

  // Dual rating transition: A rating slides left into "SS ➜ B" position,
  // then arrow + B + diff badge fade in.
  const ratingStart = comparisonStart + a.fillDuration * a.nameAppearRatio;
  const ratingTransitionDur =
    Math.max(1, comp.dualRatingSlideFrames) + Math.max(1, comp.dualRatingFadeFrames);
  out.push({
    targetId: "radar-rating",
    start: ratingStart,
    end: ratingStart + ratingTransitionDur,
    pageLabel,
    behavior: "评分滑动+淡入",
    comparisonIndex,
    fieldIds: compFields(SWAP_RATING_FIELDS),
  });

  // Legend fade-in: frame 0..20 of comparison layer.
  out.push({
    targetId: "legend",
    start: comparisonStart,
    end: comparisonStart + 20,
    pageLabel,
    behavior: "图例淡入",
    comparisonIndex,
    fieldIds: compFields(LEGEND_FIELDS),
  });
}

function buildSingleSegments(page: RadarVideoProps): RenderSegment[] {
  const out: RenderSegment[] = [];
  pushPageSegments(out, page, "", 0, 0);
  return out;
}

function buildMultiSegments(config: MultiPageConfig): RenderSegment[] {
  const compIndexMap = new Map<number, number>();
  config.comparisons.forEach((c, ci) => compIndexMap.set(c.firstPageIndex, ci));
  const compared = new Set<number>();
  const out: RenderSegment[] = [];
  let base = 0;
  const mergedPages = config.pages.map((p) =>
    applyGlobalOverride(p, config.globalOverride),
  );
  for (let i = 0; i < config.pages.length; i++) {
    if (compared.has(i)) continue;
    const compIdx = compIndexMap.get(i);
    const comp = compIdx !== undefined ? config.comparisons[compIdx] : undefined;
    if (comp && compIdx !== undefined && i + 1 < config.pages.length) {
      const left = mergedPages[i];
      const right = mergedPages[i + 1];
      pushPageSegments(out, left, `第${i + 1}页`, base, i);

      const leftEnd = calculateDuration(left.animation);
      const comparisonStart = base + leftEnd + comp.delayFrames;
      pushComparisonSegments(
        out,
        right,
        comp,
        compIdx,
        comparisonStart,
        i + 1,
        `第${i + 1}→${i + 2}页`,
      );

      base += calculateComparisonDuration(left, right, comp);
      compared.add(i);
      compared.add(i + 1);
    } else {
      pushPageSegments(out, mergedPages[i], `第${i + 1}页`, base, i);
      base += calculateDuration(mergedPages[i].animation);
    }
  }
  return out;
}

function calcMultiDuration(config: MultiPageConfig): number {
  if (!config.pages.length) return 1;
  const mergedPages = config.pages.map((p) =>
    applyGlobalOverride(p, config.globalOverride),
  );
  const compMap = new Map<number, (typeof config.comparisons)[number]>();
  for (const c of config.comparisons) compMap.set(c.firstPageIndex, c);
  const compared = new Set<number>();
  let t = 0;
  for (let i = 0; i < config.pages.length; i++) {
    if (compared.has(i)) continue;
    const comp = compMap.get(i);
    if (comp && i + 1 < config.pages.length) {
      t += calculateComparisonDuration(mergedPages[i], mergedPages[i + 1], comp);
      compared.add(i);
      compared.add(i + 1);
    } else {
      t += calculateDuration(mergedPages[i].animation);
    }
  }
  return Math.max(1, t);
}

type HoverState = { frame: number; clientX: number; clientY: number } | null;

export const PreviewPanel: React.FC<PreviewPanelProps> = (panelProps) => {
  const playerRef = useRef<PlayerRef>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);

  // 用户上传文件的鉴权 objectURL 缓存（替换 Player inputProps 中的 uploads URL）。
  const { getObjectUrl, cache: uploadObjectUrlCache } = useUploadObjectUrls();
  const [hover, setHover] = useState<HoverState>(null);
  const [viewStart, setViewStart] = useState(0);
  const [viewEnd, setViewEnd] = useState(1);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const seekDragRef = useRef(false);
  const panStateRef = useRef<{
    startClientX: number;
    startViewStart: number;
    startViewEnd: number;
  } | null>(null);
  const { focus } = useFieldFocus();

  const musicUrl =
    panelProps.mode === "single"
      ? panelProps.musicUrl
      : panelProps.config.musicUrl;
  const audioSrc = musicUrl ? `/${musicUrl}` : undefined;
  const audioName = musicUrl ? musicUrl.split("/").pop() || musicUrl : null;

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [audioOffsetFrames, setAudioOffsetFrames] = useState(0);
  const [audioDurationSec, setAudioDurationSec] = useState(0);
  const [audioMuted, setAudioMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.8);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const currentFrameRef = useRef(0);
  currentFrameRef.current = currentFrame;

  const { component, inputProps, durationInFrames, segments } = useMemo(() => {
    if (panelProps.mode === "single") {
      return {
        component: RadarVideo as React.FC<Record<string, unknown>>,
        inputProps: panelProps.props as Record<string, unknown>,
        durationInFrames: calculateDuration(panelProps.props.animation),
        segments: buildSingleSegments(panelProps.props),
      };
    }
    return {
      component: MultiPageVideo as React.FC<Record<string, unknown>>,
      inputProps: { config: panelProps.config },
      durationInFrames: calcMultiDuration(panelProps.config),
      segments: buildMultiSegments(panelProps.config),
    };
  }, [panelProps]);

  // 将 inputProps 中用户上传的剪影 URL 替换为鉴权 objectURL。
  // getObjectUrl 首次调用时触发异步 fetch，cache 更新后 Player 自动重渲染拿到新 URL。
  const playerInputProps = useMemo(() => {
    const uploadsUrlPattern = /\/api\/v1\/files\/uploads\/([^/?#]+)$/;
    function replaceUploads(obj: unknown): unknown {
      if (Array.isArray(obj)) return obj.map(replaceUploads);
      if (obj && typeof obj === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          if (k === "silhouetteSrc" && typeof v === "string") {
            const m = uploadsUrlPattern.exec(v);
            if (m) {
              const name = decodeURIComponent(m[1]);
              const cached = uploadObjectUrlCache[name];
              if (cached) {
                out[k] = cached;
              } else {
                // 触发异步加载（下次 cache 更新时 useMemo 会重算）
                getObjectUrl(name);
                out[k] = v; // 暂时保留原值
              }
              continue;
            }
          }
          out[k] = replaceUploads(v);
        }
        return out;
      }
      return obj;
    }
    return replaceUploads(inputProps) as Record<string, unknown>;
  }, [inputProps, uploadObjectUrlCache, getObjectUrl]);

  useEffect(() => {
    if (!isPausedRef.current) {
      playerRef.current?.play();
    }
  }, [component, inputProps, durationInFrames]);

  const didInitViewRef = useRef(false);
  useEffect(() => {
    if (didInitViewRef.current) return;
    didInitViewRef.current = true;
    setViewStart(0);
    setViewEnd(Math.max(1, durationInFrames));
  }, [durationInFrames]);

  const viewRange = Math.max(1, viewEnd - viewStart);
  const laneLayout = useMemo(() => computeLaneLayout(segments), [segments]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onPlay = () => setIsPaused(false);
    const onPause = () => setIsPaused(true);
    const onFrame = (e: { detail: { frame: number } }) => setCurrentFrame(e.detail.frame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("frameupdate", onFrame as never);
    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("frameupdate", onFrame as never);
    };
  }, []);

  useEffect(() => {
    if (!audioSrc) {
      setPeaks(null);
      setAudioDurationSec(0);
      return;
    }
    let cancelled = false;
    setPeaks(null);
    setAudioDurationSec(0);
    (async () => {
      try {
        const res = await fetch(audioSrc);
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const buf = await res.arrayBuffer();
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new Ctx();
        const decoded = await ctx.decodeAudioData(buf.slice(0));
        if (cancelled) {
          void ctx.close();
          return;
        }
        setAudioDurationSec(decoded.duration);
        const ch = decoded.getChannelData(0);
        const out = new Float32Array(PEAK_COUNT);
        const block = Math.max(1, Math.floor(ch.length / PEAK_COUNT));
        for (let i = 0; i < PEAK_COUNT; i++) {
          let max = 0;
          const s = i * block;
          const e = Math.min(ch.length, s + block);
          for (let j = s; j < e; j++) {
            const v = Math.abs(ch[j]);
            if (v > max) max = v;
          }
          out[i] = max;
        }
        setPeaks(out);
        void ctx.close();
      } catch (err) {
        if (!cancelled) console.warn("audio load/decode failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [audioSrc]);

  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;
    audio.volume = audioVolume;
    audio.muted = audioMuted;
  }, [audioVolume, audioMuted]);

  useEffect(() => {
    const player = playerRef.current;
    const audio = audioElRef.current;
    if (!player || !audio || !audioSrc) return;

    const expected = (frame: number) =>
      (frame - audioOffsetFrames) / VIDEO_FPS;

    const sync = (frame: number, playing: boolean) => {
      const t = expected(frame);
      const dur = audio.duration || audioDurationSec || 0;
      if (t < 0 || (dur > 0 && t > dur)) {
        if (!audio.paused) audio.pause();
        return;
      }
      if (Math.abs(audio.currentTime - t) > AUDIO_SYNC_THRESHOLD_SEC) {
        try {
          audio.currentTime = t;
        } catch {
          // seek may fail before audio is ready; ignore
        }
      }
      if (playing && audio.paused) {
        void audio.play().catch(() => {});
      } else if (!playing && !audio.paused) {
        audio.pause();
      }
    };

    const onPlay = () => sync(player.getCurrentFrame(), true);
    const onPause = () => audio.pause();
    const onFrame = (e: { detail: { frame: number } }) =>
      sync(e.detail.frame, player.isPlaying());

    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("frameupdate", onFrame as never);

    // Initial sync after loading metadata.
    const onReady = () => sync(player.getCurrentFrame(), player.isPlaying());
    audio.addEventListener("loadedmetadata", onReady);

    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("frameupdate", onFrame as never);
      audio.removeEventListener("loadedmetadata", onReady);
      audio.pause();
    };
  }, [audioSrc, audioOffsetFrames, audioDurationSec]);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) {
      player.pause();
    } else {
      player.play();
    }
  }, []);

  const frameFromEvent = useCallback(
    (clientX: number): number => {
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const frame = viewStart + ratio * viewRange;
      return Math.round(Math.min(durationInFrames - 1, Math.max(0, frame)));
    },
    [viewStart, viewRange, durationInFrames],
  );

  const seekToClientX = useCallback(
    (clientX: number) => {
      const player = playerRef.current;
      if (!player) return;
      const frame = frameFromEvent(clientX);
      player.seekTo(frame);
      setCurrentFrame(frame);
    },
    [frameFromEvent],
  );

  const onBarMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button === 2) {
        // Right button: seek + start playhead drag.
        e.preventDefault();
        seekDragRef.current = true;
        seekToClientX(e.clientX);
      } else if (e.button === 0) {
        // Left button: start panning the view. No seek; segment onClick
        // still fires for parameter jumps when the click lands on a bar.
        e.preventDefault();
        panStateRef.current = {
          startClientX: e.clientX,
          startViewStart: viewStart,
          startViewEnd: viewEnd,
        };
      }
    },
    [seekToClientX, viewStart, viewEnd],
  );

  const onBarContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (seekDragRef.current) {
        seekToClientX(e.clientX);
        return;
      }
      const pan = panStateRef.current;
      if (!pan) return;
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const startRange = pan.startViewEnd - pan.startViewStart;
      const deltaFrames = -((e.clientX - pan.startClientX) / rect.width) * startRange;
      let newStart = pan.startViewStart + deltaFrames;
      const maxStart = Math.max(0, durationInFrames - startRange);
      if (newStart < 0) newStart = 0;
      if (newStart > maxStart) newStart = maxStart;
      setViewStart(newStart);
      setViewEnd(newStart + startRange);
    };
    const onMouseUp = () => {
      seekDragRef.current = false;
      panStateRef.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [seekToClientX, durationInFrames]);

  const onBarMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setHover({ frame: frameFromEvent(e.clientX), clientX: e.clientX, clientY: e.clientY });
    },
    [frameFromEvent],
  );

  const onBarLeave = useCallback(() => setHover(null), []);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const pivot = viewStart + ratio * viewRange;
      const factor = Math.exp(e.deltaY * 0.0015);
      const minRange = 2;
      const maxRange = Math.max(1, durationInFrames);
      const newRange = Math.min(maxRange, Math.max(minRange, viewRange * factor));
      let newStart = pivot - ratio * newRange;
      let newEnd = newStart + newRange;
      if (newStart < 0) {
        newEnd -= newStart;
        newStart = 0;
      }
      if (newEnd > durationInFrames) {
        newStart -= newEnd - durationInFrames;
        newEnd = durationInFrames;
        if (newStart < 0) newStart = 0;
      }
      setViewStart(newStart);
      setViewEnd(newEnd);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [viewStart, viewRange, durationInFrames]);

  const onSegmentClick = useCallback(
    (seg: RenderSegment, e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const player = playerRef.current;
      if (player) {
        player.seekTo(seg.start);
        setCurrentFrame(seg.start);
      }
      focus(seg.fieldIds, {
        pageIndex: seg.pageIndex,
        comparisonIndex: seg.comparisonIndex,
      });
    },
    [focus],
  );

  const playheadPct = ((currentFrame - viewStart) / viewRange) * 100;

  const musicLaneTop = audioSrc
    ? laneLayout.totalHeight + MUSIC_GROUP_GAP
    : laneLayout.totalHeight;
  const totalBarHeight = audioSrc
    ? laneLayout.totalHeight + MUSIC_GROUP_GAP + MUSIC_LANE_HEIGHT
    : laneLayout.totalHeight;
  const audioFrameDuration = audioDurationSec * VIDEO_FPS;

  const waveformBars = useMemo(() => {
    if (!peaks || peaks.length === 0 || audioFrameDuration <= 0) return [];
    const bars: Array<{ leftPct: number; widthPct: number; h: number }> = [];
    for (let i = 0; i < peaks.length; i++) {
      const f0 = audioOffsetFrames + (i / peaks.length) * audioFrameDuration;
      const f1 = audioOffsetFrames + ((i + 1) / peaks.length) * audioFrameDuration;
      if (f1 <= viewStart || f0 >= viewEnd) continue;
      bars.push({
        leftPct: ((f0 - viewStart) / viewRange) * 100,
        widthPct: Math.max(0.05, ((f1 - f0) / viewRange) * 100),
        h: peaks[i],
      });
    }
    return bars;
  }, [peaks, audioOffsetFrames, audioFrameDuration, viewStart, viewEnd, viewRange]);

  const audioRangePct = useMemo(() => {
    if (!audioSrc || audioFrameDuration <= 0) return null;
    const f0 = audioOffsetFrames;
    const f1 = audioOffsetFrames + audioFrameDuration;
    return {
      leftPct: ((f0 - viewStart) / viewRange) * 100,
      widthPct: ((f1 - f0) / viewRange) * 100,
    };
  }, [audioSrc, audioOffsetFrames, audioFrameDuration, viewStart, viewRange]);

  const hoverInfoStyle: React.CSSProperties | null = useMemo(() => {
    if (!hover || !barRef.current) return null;
    const rect = barRef.current.getBoundingClientRect();
    const left = hover.clientX - rect.left;
    return {
      position: "absolute",
      left,
      top: -22,
      transform: "translateX(-50%)",
      pointerEvents: "none",
      whiteSpace: "nowrap",
    };
  }, [hover]);

  return (
    <div className="w-full space-y-2">
      <div
        className="remotion-player-container overflow-hidden rounded-lg border border-unfocused-border-color shadow-lg mx-auto"
        style={{
          width: `min(100%, calc(45vh * ${VIDEO_WIDTH} / ${VIDEO_HEIGHT}))`,
          aspectRatio: `${VIDEO_WIDTH} / ${VIDEO_HEIGHT}`,
        }}
      >
        <Player
          ref={playerRef}
          component={component}
          inputProps={playerInputProps}
          durationInFrames={durationInFrames}
          fps={VIDEO_FPS}
          compositionWidth={VIDEO_WIDTH}
          compositionHeight={VIDEO_HEIGHT}
          style={{ width: "100%", height: "100%" }}
          loop
          clickToPlay={false}
          showPosterWhenPaused={false}
          numberOfSharedAudioTags={0}
        />
      </div>
      <audio ref={audioElRef} src={audioSrc ?? undefined} preload="auto" />
      <div
        className="relative w-full"
        style={{ paddingLeft: LEFT_GUTTER, paddingTop: 18 }}
      >
        <div
          className="absolute left-0 select-none"
          style={{
            top: 18,
            width: LEFT_GUTTER,
            height: totalBarHeight,
          }}
        >
          {audioSrc && (
            <div
              className="flex items-center justify-end text-[11px] text-muted-foreground"
              style={{
                position: "absolute",
                top: musicLaneTop,
                height: MUSIC_LANE_HEIGHT,
                right: GUTTER_TIMELINE_GAP,
                left: 0,
              }}
            >
              <span>音乐</span>
            </div>
          )}
          {TARGET_ORDER.map((id, gi) => {
            const meta = TARGET_META[id];
            const top = laneLayout.groupTop[id];
            const height = laneLayout.groupHeight[id];
            const isLast = gi === TARGET_ORDER.length - 1;
            return (
              <React.Fragment key={id}>
                <div
                  className="flex items-center justify-end text-[11px] text-muted-foreground"
                  style={{
                    position: "absolute",
                    top,
                    height,
                    right: GUTTER_TIMELINE_GAP,
                    left: 0,
                  }}
                >
                  <span>{meta.label}</span>
                </div>
                {!isLast && (
                  <div
                    className="absolute border-t border-unfocused-border-color"
                    style={{
                      top: top + height + GROUP_GAP / 2 - 0.5,
                      left: 0,
                      right: 0,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div
          ref={barRef}
          className="relative w-full rounded bg-muted cursor-grab active:cursor-grabbing select-none border-l border-unfocused-border-color"
          style={{ height: totalBarHeight, overflow: "hidden" }}
          onMouseDown={onBarMouseDown}
          onMouseMove={onBarMove}
          onMouseLeave={onBarLeave}
          onContextMenu={onBarContextMenu}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={durationInFrames}
          aria-valuenow={currentFrame}
        >
          {audioSrc && (
            <>
              <div
                className="absolute pointer-events-none border-t border-unfocused-border-color/60"
                style={{
                  top: musicLaneTop - MUSIC_GROUP_GAP / 2 - 0.5,
                  left: 0,
                  right: 0,
                }}
              />
              <div
                className="absolute pointer-events-none"
                style={{
                  top: musicLaneTop,
                  left: 0,
                  right: 0,
                  height: MUSIC_LANE_HEIGHT,
                  background: "rgba(163, 230, 53, 0.06)",
                }}
              />
              {audioRangePct && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: musicLaneTop,
                    left: `${audioRangePct.leftPct}%`,
                    width: `${audioRangePct.widthPct}%`,
                    height: MUSIC_LANE_HEIGHT,
                    borderLeft: "1px solid rgba(163, 230, 53, 0.5)",
                    borderRight: "1px solid rgba(163, 230, 53, 0.5)",
                  }}
                />
              )}
              {waveformBars.map((b, i) => {
                const h = Math.max(1, b.h * (MUSIC_LANE_HEIGHT - 4));
                return (
                  <div
                    key={`wf-${i}`}
                    className="absolute pointer-events-none"
                    style={{
                      left: `${b.leftPct}%`,
                      width: `${b.widthPct}%`,
                      top: musicLaneTop + (MUSIC_LANE_HEIGHT - h) / 2,
                      height: h,
                      background: "#a3e635",
                      opacity: 0.75,
                    }}
                  />
                );
              })}
            </>
          )}
          {TARGET_ORDER.slice(0, -1).map((id) => {
            const top =
              laneLayout.groupTop[id] +
              laneLayout.groupHeight[id] +
              GROUP_GAP / 2 -
              0.5;
            return (
              <div
                key={`div-${id}`}
                className="absolute pointer-events-none border-t border-unfocused-border-color/60"
                style={{ top, left: 0, right: 0 }}
              />
            );
          })}
          {segments.map((seg, i) => {
            const meta = TARGET_META[seg.targetId];
            if (seg.end <= viewStart || seg.start >= viewEnd) return null;
            const leftPct = ((seg.start - viewStart) / viewRange) * 100;
            const widthPct = Math.max(
              0.2,
              ((seg.end - seg.start) / viewRange) * 100,
            );
            const inlineLabel = seg.behavior;
            const lane = laneLayout.laneByIndex.get(i) ?? 0;
            const top =
              laneLayout.groupTop[seg.targetId] +
              lane * (ROW_HEIGHT + LANE_GAP);
            return (
              <div
                key={i}
                onClick={(e) => onSegmentClick(seg, e)}
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top,
                  height: ROW_HEIGHT,
                  background: meta.color,
                  borderRadius: 3,
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.22)",
                  cursor: "pointer",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  lineHeight: 1,
                  color: "rgba(0,0,0,0.78)",
                  fontWeight: 500,
                  padding: "0 4px",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "100%",
                  }}
                >
                  {inlineLabel}
                </span>
              </div>
            );
          })}
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: `${playheadPct}%`,
              width: 2,
              background: "#ffffff",
              boxShadow: "0 0 4px rgba(0,0,0,0.7)",
              transform: "translateX(-1px)",
            }}
          />
          {hover && (
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left: `${((hover.frame - viewStart) / viewRange) * 100}%`,
                width: 1,
                background: "rgba(255,255,255,0.5)",
                transform: "translateX(-0.5px)",
              }}
            />
          )}
          {hover && hoverInfoStyle && (
            <div
              className="text-[10px] leading-none text-muted-foreground"
              style={hoverInfoStyle}
            >
              帧 {hover.frame} / {durationInFrames} · {(hover.frame / VIDEO_FPS).toFixed(2)}s
            </div>
          )}
        </div>
      </div>
      {audioSrc && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div
            className="overflow-hidden w-full text-foreground"
            title={audioName ?? undefined}
          >
            <div className="marquee-track">
              <span>🎵 {audioName}</span>
              <span aria-hidden>🎵 {audioName}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 whitespace-nowrap">
            <span className="opacity-70">{audioDurationSec.toFixed(2)}s</span>
            <label className="flex items-center gap-1">
              偏移
              <input
                type="number"
                value={audioOffsetFrames}
                onChange={(e) =>
                  setAudioOffsetFrames(Number(e.target.value) || 0)
                }
                className="w-16 h-6 px-1 text-xs text-center rounded border border-unfocused-border-color bg-background text-foreground"
              />
              帧
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={audioMuted}
                onChange={(e) => setAudioMuted(e.target.checked)}
              />
              静音
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={audioVolume}
              onChange={(e) => setAudioVolume(Number(e.target.value))}
              className="w-20"
            />
          </div>
        </div>
      )}
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={togglePlay}
          className="px-4 py-1.5 text-sm rounded-md border border-unfocused-border-color bg-card hover:bg-muted text-foreground transition-colors"
        >
          {isPaused ? "▶ 播放" : "⏸ 暂停"}
        </button>
      </div>
    </div>
  );
};
