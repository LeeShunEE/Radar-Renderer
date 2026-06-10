/**
 * 新用户引导页面。
 *
 * OAuth 首次登录后引导设置用户名，
 * 可选设置密码。
 */
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { setUsername, setPassword } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function WelcomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [username, setUsernameValue] = useState("");
  const [password, setPasswordValue] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 如果用户已登录且已有用户名，跳转到主页
  React.useEffect(() => {
    if (user?.username) {
      router.push("/app");
    }
  }, [user, router]);

  const handleSetUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (username.length < 3 || username.length > 64) {
      setError("用户名长度应为 3-64 字符");
      setLoading(false);
      return;
    }

    try {
      await setUsername(username);
      router.push("/app");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "设置用户名失败";
      setError(message);
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password.length < 8) {
      setError("密码长度应至少 8 位");
      setLoading(false);
      return;
    }

    try {
      await setPassword(password);
      setShowPasswordForm(false);
      setError(null);
      // 密码设置成功后继续留在页面，用户可以继续设置用户名或跳过
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "设置密码失败";
      setError(message);
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (!username) {
      setError("请先设置用户名");
      return;
    }
    router.push("/app");
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">欢迎加入！</h1>
        <p className="text-sm text-muted-foreground mt-1">
          设置您的用户名以完成注册
        </p>
      </div>

      {!showPasswordForm ? (
        <form onSubmit={handleSetUsername} className="space-y-4">
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

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "设置中…" : "设置用户名并开始使用"}
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setShowPasswordForm(true)}
              disabled={loading}
            >
              设置密码（可选）
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={handleSkip}
              disabled={loading || !username}
            >
              暂不设置
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPasswordValue(e.target.value)}
              placeholder="输入密码（至少 8 位）"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              设置密码后可使用密码登录
            </p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "设置中…" : "设置密码"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setShowPasswordForm(false)}
            disabled={loading}
          >
            返回
          </Button>
        </form>
      )}
    </Card>
  );
}