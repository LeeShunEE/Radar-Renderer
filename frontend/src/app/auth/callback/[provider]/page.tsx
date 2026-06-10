/**
 * OAuth 回调页面。
 *
 * 处理 OAuth provider（Google/GitHub）的回调，
 * 提取 code/state 参数，调用后端完成登录，
 * 根据是否新用户跳转到欢迎页面或主页。
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { handleOAuthCallback } from "@/lib/auth-store";
import { Card } from "@/components/ui/card";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      const provider = window.location.pathname.split("/").pop() || "";
      const code = searchParams.get("code");
      const state = searchParams.get("state");

      if (!code || !state) {
        setError("OAuth 回调参数缺失");
        setLoading(false);
        return;
      }

      try {
        const isNewUser = await handleOAuthCallback(provider, code, state);
        if (isNewUser) {
          // 新用户，跳转到欢迎页面设置用户名
          router.push("/welcome");
        } else {
          // 已有用户，跳转到主页
          router.push("/app");
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "OAuth 登录失败";
        setError(message);
        setLoading(false);
      }
    };

    processCallback();
  }, [router, searchParams]);

  return (
    <Card className="p-6 space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">OAuth 登录</h1>
        {loading && (
          <p className="text-sm text-muted-foreground mt-4">
            正在处理登录...
          </p>
        )}
        {error && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={() => router.push("/login")}
              className="text-sm text-primary hover:underline"
            >
              返回登录页面
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}