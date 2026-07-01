/**
 * 资源选择器：合并公共资源 + 用户上传资源。
 * 用于 silhouette、music、backgrounds 选择。
 */
"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { usePublicAssets } from "@/hooks/usePublicAssets";
import { useFileManagement } from "@/hooks/useFileManagement";
import { useUploadObjectUrls } from "@/hooks/useUploadObjectUrls";
import { RefreshCw, Upload, ClipboardPaste } from "lucide-react";
import { checkBackgroundVideo } from "@/lib/media-guard";
import { extractPastedImage, pastedImageName } from "@/lib/clipboard-image";

/** 读取视频文件的宽高（异步，jsdom 中会走 onerror 分支，回退 0×0）。 */
async function readVideoMeta(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({ width: v.videoWidth, height: v.videoHeight });
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    v.src = url;
  });
}

type AssetCategory = "silhouettes" | "music" | "backgrounds";

interface AssetOption {
  name: string;
  path: string;
  type: "public" | "user";
}

interface AssetSelectorProps {
  category: AssetCategory;
  value: string;
  onChange: (path: string) => void;
  /** 是否显示播放按钮（仅 music 有效） */
  showPlayButton?: boolean;
}

/** 文件名扩展名过滤正则 */
const SIL_EXT_RE = /\.(png|jpg|jpeg|gif|webp|svg)$/i;
const MUSIC_EXT_RE = /\.(mp3|wav|ogg|m4a|aac)$/i;
const BG_EXT_RE = /\.(png|jpg|jpeg|gif|webp|svg|mp4|webm|mov)$/i;

/** 判断文件名是否为视频 */
const isVideoName = (name: string) => /\.(mp4|webm|mov)$/i.test(name);

export function AssetSelector({
  category,
  value,
  onChange,
  showPlayButton = false,
}: AssetSelectorProps) {
  const {
    silhouettes,
    music,
    loading: assetsLoading,
    refresh: refreshAssets,
  } = usePublicAssets();

  const {
    files: userFiles,
    loading: filesLoading,
    uploading,
    upload,
    getDownloadUrl,
  } = useFileManagement();

  // 用户上传文件的鉴权 objectURL 缓存（裸 http URL 作 <img src> 会 401）。
  const { getObjectUrl } = useUploadObjectUrls();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  // 背景视频上传软警告（决策 Q7）：仅提示，不拦截上传
  const [bgWarnings, setBgWarnings] = useState<string[]>([]);
  // 粘贴上传：仅图片类别（剪影/背景）支持；用 hover 限定作用域，避免多个选择器同时响应同一次 Ctrl+V
  const acceptsImagePaste = category === "silhouettes" || category === "backgrounds";
  const hoveredRef = useRef(false);
  const [pasteHint, setPasteHint] = useState<string | null>(null);

  // 合并公共资源和用户上传资源
  // backgrounds 无公共资源（仅用户上传）
  const publicAssets =
    category === "silhouettes" ? silhouettes : category === "music" ? music : [];

  const extRe =
    category === "silhouettes"
      ? SIL_EXT_RE
      : category === "music"
        ? MUSIC_EXT_RE
        : BG_EXT_RE;

  const userAssets = userFiles
    .filter((f) => f.name.match(extRe))
    .map((f) => ({
      name: f.name,
      path: getDownloadUrl(f.name), // 用户上传文件需要完整 URL
      type: "user" as const,
    }));

  const allOptions: AssetOption[] = [
    ...publicAssets.map((a) => ({
      ...a,
      type: "public" as const,
    })),
    ...userAssets,
  ];

  const loading = assetsLoading || filesLoading;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 清空上次警告
    setBgWarnings([]);
    // 背景视频软警告（Q7）：并行读元数据 + 上传，不因读取失败而阻塞
    if (category === "backgrounds" && (file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name))) {
      // 并行：上传不等读取完成
      const metaPromise = readVideoMeta(file).then(({ width, height }) => {
        const warns = checkBackgroundVideo({ width, height, sizeBytes: file.size });
        if (warns.length > 0) setBgWarnings(warns);
      }).catch(() => {
        // 读取失败时仅按体积检查
        const warns = checkBackgroundVideo({ width: 0, height: 0, sizeBytes: file.size });
        if (warns.length > 0) setBgWarnings(warns);
      });
      // 上传与元数据读取并行进行
      try {
        await upload(file);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch {
        // 错误已在 hook 中处理
      }
      // 等元数据读完（通常在上传完成前早已就绪）
      await metaPromise;
      return;
    }
    try {
      await upload(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      // 错误已在 hook 中处理
    }
  };

  /** 监听全局 Ctrl+V / Cmd+V：仅当鼠标悬停在本选择器上时，粘贴图片并自动选中。 */
  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      if (!acceptsImagePaste || !hoveredRef.current || uploading) return;
      const image = extractPastedImage(e.clipboardData);
      if (!image) return;
      e.preventDefault();
      const name = pastedImageName(image);
      setPasteHint(`已粘贴图片，正在上传 ${name}…`);
      try {
        await upload(new File([image], name, { type: image.type }));
        // 上传成功后自动选中该资源（用户上传文件需完整 URL）
        onChange(getDownloadUrl(name));
        setPasteHint(`已上传并选中 ${name}`);
      } catch {
        // 错误已在 hook 中处理
        setPasteHint(null);
      }
    },
    [acceptsImagePaste, uploading, upload, onChange, getDownloadUrl],
  );

  useEffect(() => {
    if (!acceptsImagePaste) return;
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [acceptsImagePaste, handlePaste]);

  const togglePlay = (filePath: string, isUserUpload?: boolean, fileName?: string) => {
    if (playing && audioRef) {
      audioRef.pause();
      setPlaying(false);
    } else {
      if (audioRef) {
        audioRef.pause();
      }
      // 用户上传文件需鉴权：用 objectURL；公共资源直接用路径。
      let src: string;
      if (isUserUpload && fileName) {
        const cached = getObjectUrl(fileName);
        src = cached ?? filePath; // fallback（首次加载时可能未就绪）
      } else {
        src = filePath.startsWith("http") ? filePath : `/${filePath}`;
      }
      const audio = new Audio(src);
      audio.onended = () => setPlaying(false);
      audio.play();
      setAudioRef(audio);
      setPlaying(true);
    }
  };

  // 清理音频播放
  React.useEffect(() => {
    return () => {
      audioRef?.pause();
    };
  }, [audioRef]);

  /** 是否使用网格布局（silhouettes / backgrounds 用网格，music 用列表）。 */
  const useGridLayout = category === "silhouettes" || category === "backgrounds";

  /** accept 属性 */
  const acceptAttr =
    category === "silhouettes"
      ? "image/*"
      : category === "music"
        ? "audio/*"
        : "image/*,video/*";

  /** header 标签文字 */
  const headerLabel =
    category === "silhouettes"
      ? "剪影图片"
      : category === "music"
        ? "背景音乐"
        : "背景媒体";

  return (
    <div
      className="space-y-2"
      onMouseEnter={() => {
        hoveredRef.current = true;
      }}
      onMouseLeave={() => {
        hoveredRef.current = false;
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{headerLabel}</span>
        <div className="flex items-center gap-1">
          <Button
            onClick={refreshAssets}
            disabled={loading}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            <Upload className="w-3 h-3" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptAttr}
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* 粘贴提示：鼠标悬停本区域时可直接 Ctrl+V 粘贴图片上传并自动选中 */}
      {acceptsImagePaste && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <ClipboardPaste className="w-3 h-3 shrink-0" />
          {pasteHint ?? "悬停此处按 Ctrl+V（⌘V）可粘贴图片"}
        </p>
      )}

      {/* 背景视频上传软警告（Q7）：不拦截上传，仅提示 */}
      {bgWarnings.length > 0 && (
        <div className="rounded-md border border-yellow-400/50 bg-yellow-50/10 px-2 py-1.5 space-y-0.5">
          {bgWarnings.map((w, i) => (
            <p key={i} className="text-xs text-yellow-600 dark:text-yellow-400">
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      {loading && allOptions.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">加载中...</p>
      ) : allOptions.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          暂无资源，点击上传按钮添加
        </p>
      ) : (
        <div className="border border-unfocused-border-color rounded-md overflow-hidden max-h-[200px] overflow-y-auto">
          {/* 公共资源 */}
          {publicAssets.length > 0 && (
            <div className="border-b border-unfocused-border-color">
              <div className="px-2 py-1 text-xs text-muted-foreground bg-muted/30">
                公共资源
              </div>
              {useGridLayout ? (
                <div className="grid grid-cols-5 gap-1 p-1">
                  {publicAssets.map((asset) => {
                    const selected = value === asset.path;
                    return (
                      <button
                        key={asset.path}
                        type="button"
                        onClick={() => onChange(asset.path)}
                        className={`rounded-lg border-2 p-1 transition-all ${
                          selected
                            ? "border-primary scale-105 opacity-100"
                            : "border-transparent opacity-50 hover:opacity-80 hover:border-muted-foreground/30"
                        }`}
                        title={asset.name}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/${asset.path}`}
                          alt={asset.name}
                          className="mx-auto max-h-12 object-contain"
                          loading="lazy"
                        />
                      </button>
                    );
                  })}
                </div>
              ) : (
                publicAssets.map((asset) => {
                  const selected = value === asset.path;
                  const isPlayingThis = playing && value === asset.path;
                  return (
                    <div
                      key={asset.path}
                      onClick={() => onChange(asset.path)}
                      className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors border-l-2 ${
                        selected
                          ? "border-l-blue-500 bg-blue-500/10"
                          : "border-l-transparent hover:bg-muted/50"
                      }`}
                    >
                      {showPlayButton && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePlay(asset.path);
                          }}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted text-xs shrink-0"
                        >
                          {isPlayingThis ? "⏸" : "▶"}
                        </button>
                      )}
                      <span className="text-xs truncate">{asset.name}</span>
                      {selected && (
                        <span className="text-xs text-blue-500 shrink-0">选中</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 用户上传资源 */}
          {userAssets.length > 0 && (
            <div>
              <div className="px-2 py-1 text-xs text-muted-foreground bg-muted/30">
                我的上传
              </div>
              {useGridLayout ? (
                <div className="grid grid-cols-5 gap-1 p-1">
                  {userAssets.map((asset) => {
                    const selected = value === asset.path;
                    return (
                      <button
                        key={asset.path}
                        type="button"
                        onClick={() => onChange(asset.path)}
                        className={`rounded-lg border-2 p-1 transition-all ${
                          selected
                            ? "border-primary scale-105 opacity-100"
                            : "border-transparent opacity-50 hover:opacity-80 hover:border-muted-foreground/30"
                        }`}
                        title={asset.name}
                      >
                        {/* 用户上传文件需鉴权，走 objectURL（裸 http src 会 401）。 */}
                        {category === "backgrounds" && isVideoName(asset.name) ? (
                          // 视频首帧作缩略图，不自动播放、静音
                          <video
                            src={getObjectUrl(asset.name) ?? asset.path}
                            className="mx-auto max-h-12 object-contain"
                            muted
                            preload="metadata"
                          />
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={getObjectUrl(asset.name) ?? asset.path}
                            alt={asset.name}
                            className="mx-auto max-h-12 object-contain"
                            loading="lazy"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                userAssets.map((asset) => {
                  const selected = value === asset.path;
                  const isPlayingThis = playing && value === asset.path;
                  return (
                    <div
                      key={asset.path}
                      onClick={() => onChange(asset.path)}
                      className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors border-l-2 ${
                        selected
                          ? "border-l-blue-500 bg-blue-500/10"
                          : "border-l-transparent hover:bg-muted/50"
                      }`}
                    >
                      {showPlayButton && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePlay(asset.path, true, asset.name);
                          }}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted text-xs shrink-0"
                        >
                          {isPlayingThis ? "⏸" : "▶"}
                        </button>
                      )}
                      <span className="text-xs truncate">{asset.name}</span>
                      {selected && (
                        <span className="text-xs text-blue-500 shrink-0">选中</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {value && (
        <Button
          onClick={() => onChange("")}
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground"
        >
          清除选择
        </Button>
      )}
    </div>
  );
}
