/**
 * 用户上传文件 objectURL 缓存 hook。
 *
 * 上传文件端点需鉴权，裸 <img src>/<a href> 直链会 401。
 * 本 hook 通过 files.fetchUploadBlob（带 token）拉取 Blob → URL.createObjectURL，
 * 返回可直接用作 <img src> / Remotion <Img src> 的本地 objectURL。
 * 卸载时自动 revoke 全部 objectURL。
 */
"use client";

import { useState, useCallback, useRef } from "react";
import { files } from "@/lib/api-client";

export function useUploadObjectUrls() {
  const [cache, setCache] = useState<Record<string, string>>({});
  const pendingRef = useRef<Record<string, Promise<string>>>({});

  /** 获取上传文件的 objectURL（首次请求时 fetch+缓存，后续直接返回）。 */
  const getObjectUrl = useCallback((name: string): string | undefined => {
    // 已有缓存
    if (cache[name]) return cache[name];

    // 已在请求中（避免重复 fetch）
    if (name in pendingRef.current) return undefined;

    // 发起请求
    const promise = files
      .fetchUploadBlob(name)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setCache((prev) => ({ ...prev, [name]: url }));
        delete pendingRef.current[name];
        return url;
      })
      .catch(() => {
        delete pendingRef.current[name];
        return "";
      });

    pendingRef.current[name] = promise;
    return undefined;
  }, [cache]);

  return { getObjectUrl, cache };
}
