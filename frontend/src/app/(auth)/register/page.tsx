/**
 * 注册页面。
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

export default function RegisterPage() {
  const router = useRouter();
  const { register, loading, error } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (password !== confirmPassword) {
      setLocalError("两次输入的密码不一致");
      return;
    }

    if (password.length < 8) {
      setLocalError("密码长度至少 8 位");
      return;
    }

    try {
      await register(username, email, password);
      router.push("/app");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "注册失败";
      setLocalError(message);
    }
  };

  const displayError = localError ?? error;

  return (
    <Card className="p-6 space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">注册</h1>
        <p className="text-sm text-muted-foreground mt-1">
          创建账户以使用雷达图动画生成器
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">用户名</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="输入用户名（3-64 字符）"
            required
            minLength={3}
            maxLength={64}
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">邮箱</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="输入邮箱"
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">密码</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入密码（至少 8 位）"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">确认密码</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="再次输入密码"
            required
            autoComplete="new-password"
          />
        </div>

        {displayError && (
          <p className="text-sm text-red-500">{displayError}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "注册中…" : "注册"}
        </Button>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        已有账户？{" "}
        <Link href="/login" className="text-primary hover:underline">
          登录
        </Link>
      </div>
    </Card>
  );
}