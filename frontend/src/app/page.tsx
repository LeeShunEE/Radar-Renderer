"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";

/**
 * 根页面：检查认证状态后重定向。
 * 已认证 → /app，未认证 → /login。
 */
export default function Home() {
  const t = useTranslations("common");
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        router.replace("/app");
      } else {
        router.replace("/login");
      }
    }
  }, [loading, isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground">{t("loading")}</div>
    </div>
  );
}