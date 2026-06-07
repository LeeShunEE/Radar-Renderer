/**
 * 登录页面。
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const { login, loading, error } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      await login(username, password);
      router.push("/app");
    } catch (err: any) {
      setLocalError(err.message ?? "登录失败");
    }
  };

  const displayError = localError ?? error;

  return (
    <Card className="p-6 space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">登录</h1>
        <p className="text-sm text-muted-foreground mt-1">
          登录以使用雷达图动画生成器
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">用户名</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="输入用户名"
            required
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">密码</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入密码"
            required
            autoComplete="current-password"
          />
        </div>

        {displayError && (
          <p className="text-sm text-red-500">{displayError}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "登录中…" : "登录"}
        </Button>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        没有账户？{" "}
        <Link href="/register" className="text-primary hover:underline">
          注册
        </Link>
      </div>
    </Card>
  );
}