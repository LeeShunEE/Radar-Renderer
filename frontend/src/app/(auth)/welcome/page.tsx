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
import { useAuth } from "@/contexts/AuthContext";
import { setPassword, setUsername } from "@/lib/auth-store";
import { auth } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function WelcomePage() {
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
      setError("用户名长度应为 3-64 字符");
      return;
    }

    const passwordOptional = hasOAuth === true;
    if (!passwordOptional && password.length < 8) {
      setError("密码长度应至少 8 位");
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
      setError(err instanceof Error ? err.message : "设置失败");
      setLoading(false);
    }
  };

  const passwordOptional = hasOAuth === true;

  return (
    <Card className="p-6 space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">欢迎加入！</h1>
        <p className="text-sm text-muted-foreground mt-1">
          完善账户信息以开始使用
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">用户名</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsernameValue(e.target.value)}
            placeholder="输入用户名（3-64 字符）"
            required
            minLength={3}
            maxLength={64}
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            密码{passwordOptional ? "（可选）" : ""}
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            placeholder={
              passwordOptional
                ? "设置密码后可用密码登录（可跳过）"
                : "输入密码（至少 8 位）"
            }
            minLength={passwordOptional ? undefined : 8}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">
            {passwordOptional
              ? "您已绑定第三方登录，密码为备选登录方式"
              : "邮箱注册用户需设置密码以便后续登录"}
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "设置中…" : "完成并开始使用"}
        </Button>
      </form>
    </Card>
  );
}
