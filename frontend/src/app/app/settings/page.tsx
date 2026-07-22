/**
 * 账户设置页面。
 *
 * 包含：
 * - 设置/修改用户名
 * - 设置/修改密码
 * - 查看已绑定 OAuth 账户
 * - 绑定/解绑 OAuth 账户
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { setUsername, setPassword } from "@/lib/auth-store";
import { auth } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

interface OAuthAccount {
  id: number;
  provider: string;
  provider_email: string | null;
  provider_display_name: string | null;
  created_at: string;
}

export default function SettingsPage() {
  const tLang = useTranslations("language");
  const router = useRouter();
  const { user, logout } = useAuth();
  const [username, setUsernameValue] = useState("");
  const [password, setPasswordValue] = useState("");
  const [oauthAccounts, setOAuthAccounts] = useState<OAuthAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 加载用户信息
  useEffect(() => {
    if (user) {
      setUsernameValue(user.username || "");
    }
  }, [user]);

  // 加载 OAuth 账户列表
  useEffect(() => {
    const loadOAuthAccounts = async () => {
      try {
        const accounts = await auth.listOAuthAccounts();
        setOAuthAccounts(accounts);
      } catch (err) {
        console.error("加载 OAuth 账户失败:", err);
      }
    };
    loadOAuthAccounts();
  }, []);

  const handleSetUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (username.length < 3 || username.length > 64) {
      setError("用户名长度应为 3-64 字符");
      setLoading(false);
      return;
    }

    try {
      await setUsername(username);
      setSuccess("用户名已更新");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "设置用户名失败";
      setError(message);
    }
    setLoading(false);
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (password.length < 8) {
      setError("密码长度应至少 8 位");
      setLoading(false);
      return;
    }

    try {
      await setPassword(password);
      setSuccess("密码已设置");
      setPasswordValue("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "设置密码失败";
      setError(message);
    }
    setLoading(false);
  };

  const handleUnbindOAuth = async (provider: string) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await auth.unbindOAuth(provider);
      setSuccess(`${provider} 账户已解绑`);
      // 重新加载账户列表
      const accounts = await auth.listOAuthAccounts();
      setOAuthAccounts(accounts);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "解绑失败";
      setError(message);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-2xl font-bold mb-6">账户设置</h1>

      <Card className="p-6 space-y-6">
        {/* 语言 */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{tLang("label")}</h2>
          <LanguageSwitcher />
        </div>

        <Separator />

        {/* 用户信息 */}
        <div>
          <h2 className="text-lg font-semibold mb-2">账户信息</h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">邮箱：</span>
              {user.email}
            </p>
            <p>
              <span className="text-muted-foreground">用户名：</span>
              {user.username || "未设置"}
            </p>
            <p>
              <span className="text-muted-foreground">验证状态：</span>
              {user.isVerified ? "已验证" : "未验证"}
            </p>
          </div>
        </div>

        <Separator />

        {/* 设置用户名 */}
        <form onSubmit={handleSetUsername} className="space-y-4">
          <h2 className="text-lg font-semibold">用户名</h2>
          <div className="space-y-2">
            <Label htmlFor="username">设置/修改用户名</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsernameValue(e.target.value)}
              placeholder="输入用户名（3-64 字符）"
              minLength={3}
              maxLength={64}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "保存中..." : "保存用户名"}
          </Button>
        </form>

        <Separator />

        {/* 设置密码 */}
        <form onSubmit={handleSetPassword} className="space-y-4">
          <h2 className="text-lg font-semibold">密码</h2>
          <div className="space-y-2">
            <Label htmlFor="password">设置/修改密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPasswordValue(e.target.value)}
              placeholder="输入密码（至少 8 位）"
              minLength={8}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              设置密码后可使用密码登录
            </p>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "保存中..." : "保存密码"}
          </Button>
        </form>

        <Separator />

        {/* OAuth 账户 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">OAuth 账户绑定</h2>
          <p className="text-sm text-muted-foreground">
            已绑定的 OAuth 账户可用于登录
          </p>

          {oauthAccounts.length > 0 ? (
            <div className="space-y-2">
              {oauthAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 border rounded"
                >
                  <div>
                    <p className="font-medium capitalize">{account.provider}</p>
                    <p className="text-sm text-muted-foreground">
                      {account.provider_email || account.provider_display_name || "无信息"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnbindOAuth(account.provider)}
                    disabled={loading}
                  >
                    解绑
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无绑定账户</p>
          )}
        </div>

        {/* 错误/成功提示 */}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-500">{success}</p>}

        <Separator />

        {/* 登出 */}
        <Button variant="destructive" onClick={handleLogout}>
          登出
        </Button>
      </Card>
    </div>
  );
}