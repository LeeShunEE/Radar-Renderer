/**
 * 统一 onboarding 页面。
 *
 * 三种注册渠道（邮箱验证码 / Google / GitHub）注册后均跳转此页，
 * 一次性设置用户名（必填）与密码：
 * - 已绑 OAuth 账户 → 密码可选（可跳过）
 * - 未绑 OAuth（邮箱注册用户）→ 密码必填（否则无法用密码登录）
 * 完成判据：user.username 非空 → /app。
 */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { setPassword, setUsername } from "@/lib/auth-store";
import { auth } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function WelcomePage() {
  const t = useTranslations("auth.welcome");
  const router = useRouter();
  const { user } = useAuth();
  const [username, setUsernameValue] = useState("");
  const [password, setPasswordValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasOAuth, setHasOAuth] = useState<boolean | null>(null);

  // user.username 非空即 onboarding 已完成 → 直接进 /app
  useEffect(() => {
    if (user?.username) {
      router.push("/app");
    }
  }, [user, router]);

  // 探测是否已绑 OAuth，决定密码是否可选
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const accounts = await auth.listOAuthAccounts();
        if (active) setHasOAuth(accounts.length > 0);
      } catch {
        // 探测失败时保守按"未绑"处理（密码必填）
        if (active) setHasOAuth(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (username.length < 3 || username.length > 64) {
      setError(t("usernameLengthError"));
      return;
    }

    const passwordOptional = hasOAuth === true;
    if (!passwordOptional && password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }

    setLoading(true);
    try {
      await setUsername(username);
      if (password) {
        await setPassword(password);
      }
      router.push("/app");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("setupFailed"));
      setLoading(false);
    }
  };

  const passwordOptional = hasOAuth === true;

  return (
    <Card className="p-6 space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">{t("usernameLabel")}</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsernameValue(e.target.value)}
            placeholder={t("usernamePlaceholder")}
            required
            minLength={3}
            maxLength={64}
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            {t("passwordLabel")}
            {passwordOptional ? t("passwordOptionalSuffix") : ""}
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            placeholder={
              passwordOptional
                ? t("passwordPlaceholderOptional")
                : t("passwordPlaceholderRequired")
            }
            minLength={passwordOptional ? undefined : 8}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">
            {passwordOptional
              ? t("passwordHintOptional")
              : t("passwordHintRequired")}
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("submitting") : t("submit")}
        </Button>
      </form>
    </Card>
  );
}
