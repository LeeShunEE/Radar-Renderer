/**
 * 资源选择器：合并公共资源 + 用户上传资源。
 * 用于 silhouette 和 music 选择。
 */
"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { usePublicAssets } from "@/hooks/usePublicAssets";
import { useFileManagement } from "@/hooks/useFileManagement";
import { RefreshCw, Upload } from "lucide-react";

type AssetCategory = "silhouettes" | "music";

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  // 合并公共资源和用户上传资源
  const publicAssets = category === "silhouettes" ? silhouettes : music;
  const userAssets = userFiles
    .filter((f) =>
      category === "silhouettes"
        ? f.name.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)
        : f.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)
    )
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
    try {
      await upload(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      // 错误已在 hook 中处理
    }
  };

  const togglePlay = (filePath: string) => {
    if (playing && audioRef) {
      audioRef.pause();
      setPlaying(false);
    } else {
      if (audioRef) {
        audioRef.pause();
      }
      const audio = new Audio(filePath.startsWith("http") ? filePath : `/${filePath}`);
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {category === "silhouettes" ? "剪影图片" : "背景音乐"}
        </span>
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
            accept={category === "silhouettes" ? "image/*" : "audio/*"}
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </div>

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
              {category === "silhouettes" ? (
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
              {category === "silhouettes" ? (
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={asset.path}
                          alt={asset.name}
                          className="mx-auto max-h-12 object-contain"
                          loading="lazy"
                        />
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