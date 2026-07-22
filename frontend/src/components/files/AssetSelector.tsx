/**
 * 资源选择器：合并公共资源 + 用户上传资源。
 * 用于 silhouette、music、backgrounds 选择。
 */
"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { usePublicAssets } from "@/hooks/usePublicAssets";
import { useFileManagement } from "@/hooks/useFileManagement";
import { useUploadObjectUrls } from "@/hooks/useUploadObjectUrls";
import { RefreshCw, Upload, ClipboardPaste } from "lucide-react";
import {
  checkBackgroundVideo,
  type BackgroundMediaKind,
  type BackgroundVideoWarning,
} from "@/lib/media-guard";
import { extractPastedImage, pastedImageName } from "@/lib/clipboard-image";
import { AUDIO_EXTS, IMAGE_EXTS, VIDEO_EXTS, extRegex } from "@/lib/asset-exts";
import { Progress } from "@/components/ui/progress";

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
  /**
   * 背景媒体类型过滤（仅 backgrounds 有效）：
   * "image" 只列/只收图片，"video" 只列/只收视频。
   * 不传则图片视频混排（历史行为，背景类型不匹配会导致渲染端报错）。
   */
  mediaKind?: BackgroundMediaKind;
  /** 嵌入上级折叠面板时隐藏重复标题，仅保留资源操作区。 */
  embedded?: boolean;
}

/** 文件名扩展名过滤正则（清单见 asset-exts.ts，与后端保持一致） */
const SIL_EXT_RE = extRegex(IMAGE_EXTS);
const MUSIC_EXT_RE = extRegex(AUDIO_EXTS);
const BG_EXT_RE = extRegex([...IMAGE_EXTS, ...VIDEO_EXTS]);
const BG_IMAGE_EXT_RE = extRegex(IMAGE_EXTS);
const BG_VIDEO_EXT_RE = extRegex(VIDEO_EXTS);

/** 判断文件名是否为视频 */
const isVideoName = (name: string) => BG_VIDEO_EXT_RE.test(name);

export function AssetSelector({
  category,
  value,
  onChange,
  showPlayButton = false,
  mediaKind,
  embedded = false,
}: AssetSelectorProps) {
  const t = useTranslations("files");
  const tc = useTranslations("common");
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
    uploadProgress,
    upload,
    getDownloadUrl,
  } = useFileManagement();

  // 用户上传文件的鉴权 objectURL 缓存（裸 http URL 作 <img src> 会 401）。
  const { getObjectUrl } = useUploadObjectUrls();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  // 背景视频上传软警告（决策 Q7）：仅提示，不拦截上传
  const [bgWarnings, setBgWarnings] = useState<BackgroundVideoWarning[]>([]);
  // 上传类型不符的硬拦截提示（如视频背景模式下选了图片）
  const [uploadError, setUploadError] = useState<string | null>(null);
  // 背景媒体过滤：仅 backgrounds 类别生效
  const bgKind = category === "backgrounds" ? mediaKind : undefined;
  // 粘贴上传：仅图片类别（剪影/图片背景）支持；用 hover 限定作用域，避免多个选择器同时响应同一次 Ctrl+V
  const acceptsImagePaste =
    category === "silhouettes" || (category === "backgrounds" && bgKind !== "video");
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
        : bgKind === "image"
          ? BG_IMAGE_EXT_RE
          : bgKind === "video"
            ? BG_VIDEO_EXT_RE
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
    setUploadError(null);
    // file.type 可能为空串（系统未识别 MIME 时），扩展名兜底
    const mime = file.type ?? "";
    const isVideoFile = mime.startsWith("video/") || BG_VIDEO_EXT_RE.test(file.name);
    const isImageFile = mime.startsWith("image/") || BG_IMAGE_EXT_RE.test(file.name);
    // 背景媒体类型硬拦截：accept 属性可被系统文件对话框的「所有文件」绕过，
    // 类型不符的文件传给渲染端会直接报错（图片进 <Video> / 视频进 <Img>），故在此拦下。
    if (bgKind === "video" && !isVideoFile) {
      setUploadError(t("uploadVideoOnly"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (bgKind === "image" && !isImageFile) {
      setUploadError(t("uploadImageOnly"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    // 背景视频软警告（Q7）：并行读元数据 + 上传，不因读取失败而阻塞
    if (category === "backgrounds" && isVideoFile) {
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
      setPasteHint(t("pasting", { name }));
      try {
        await upload(new File([image], name, { type: image.type }));
        // 上传成功后自动选中该资源（用户上传文件需完整 URL）
        onChange(getDownloadUrl(name));
        setPasteHint(t("pastedSelected", { name }));
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
        : bgKind === "image"
          ? "image/*"
          : bgKind === "video"
            ? "video/*"
            : "image/*,video/*";

  /** header 标签文字 */
  const headerLabel =
    category === "silhouettes"
      ? t("category.silhouettes")
      : category === "music"
        ? t("category.music")
        : bgKind === "image"
          ? t("category.backgroundImage")
          : bgKind === "video"
            ? t("category.backgroundVideo")
            : t("category.backgrounds");

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
      <div className={`flex items-center ${embedded ? "justify-end" : "justify-between"}`}>
        {!embedded && (
          <span className="text-xs text-muted-foreground">{headerLabel}</span>
        )}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            aria-label={t("refreshCategory", { label: headerLabel })}
            onClick={refreshAssets}
            disabled={loading}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            type="button"
            aria-label={t("uploadCategory", { label: headerLabel })}
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

      {/* 上传进度条：覆盖文件选择与粘贴两种上传入口 */}
      {uploading && (
        <div className="flex items-center gap-2">
          <Progress value={uploadProgress ?? 0} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground shrink-0">
            {uploadProgress ?? 0}%
          </span>
        </div>
      )}

      {/* 粘贴提示：鼠标悬停本区域时可直接 Ctrl+V 粘贴图片上传并自动选中 */}
      {acceptsImagePaste && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <ClipboardPaste className="w-3 h-3 shrink-0" />
          {pasteHint ?? t("pasteHint")}
        </p>
      )}

      {/* 上传类型不符的硬拦截提示 */}
      {uploadError && (
        <p
          data-testid="upload-kind-error"
          className="text-xs rounded-md border border-red-400/50 bg-red-50/10 px-2 py-1.5 text-red-600 dark:text-red-400"
        >
          ✕ {uploadError}
        </p>
      )}

      {/* 背景视频上传软警告（Q7）：不拦截上传，仅提示 */}
      {bgWarnings.length > 0 && (
        <div className="rounded-md border border-yellow-400/50 bg-yellow-50/10 px-2 py-1.5 space-y-0.5">
          {bgWarnings.map((w, i) => (
            <p key={i} className="text-xs text-yellow-600 dark:text-yellow-400">
              ⚠ {w.code === "size"
                ? t("videoWarn.size", { mb: w.mb })
                : t("videoWarn.resolution", { width: w.width, height: w.height })}
            </p>
          ))}
        </div>
      )}

      {loading && allOptions.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">{tc("loading")}</p>
      ) : allOptions.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">{t("empty")}</p>
      ) : (
        <div className="border border-unfocused-border-color rounded-md overflow-hidden max-h-[200px] overflow-y-auto">
          {/* 公共资源 */}
          {publicAssets.length > 0 && (
            <div className="border-b border-unfocused-border-color">
              <div className="px-2 py-1 text-xs text-muted-foreground bg-muted/30">
                {t("publicAssets")}
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
                        <span className="text-xs text-blue-500 shrink-0">
                          {t("selected")}
                        </span>
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
                {t("myUploads")}
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
                        <span className="text-xs text-blue-500 shrink-0">
                          {t("selected")}
                        </span>
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
          {t("clearSelection")}
        </Button>
      )}
    </div>
  );
}
