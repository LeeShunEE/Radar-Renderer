/**
 * 公共资源 hook：获取公共 silhouettes / music 列表。
 */
import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { assets } from "@/lib/api-client";

export interface PublicAsset {
  name: string;
  path: string;
  size_bytes: number;
}

export interface PublicAssetsState {
  silhouettes: PublicAsset[];
  music: PublicAsset[];
  loading: boolean;
  error: string | null;
}

export function usePublicAssets() {
  const tr = useTranslations("errors");
  const [state, setState] = useState<PublicAssetsState>({
    silhouettes: [],
    music: [],
    loading: false,
    error: null,
  });

  /** 刷新所有公共资源。 */
  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [silhouettes, music] = await Promise.all([
        assets.listSilhouettes(),
        assets.listMusic(),
      ]);
      setState({
        silhouettes,
        music,
        loading: false,
        error: null,
      });
    } catch (e) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : tr("publicAssetsFailed"),
      }));
    }
  }, [tr]);

  /** 初始化时自动加载。 */
  useEffect(() => {
    refresh();
  }, [refresh]);

  /** 获取公共资源的 URL。 */
  const getAssetUrl = useCallback((category: "silhouettes" | "music", name: string) => {
    return assets.url(category, name);
  }, []);

  return {
    ...state,
    refresh,
    getAssetUrl,
  };
}