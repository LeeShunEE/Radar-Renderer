/**
 * 忘记密码 / 重置密码页面。
 *
 * 两步：邮箱 + 验证码（reset_password purpose）→ 新密码（8 位）+ 确认。
 * 重置成功后自动登录，按 username 是否为空跳 /welcome 或 /app。
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuthState, resetPassword, sendVerificationCode } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

const RESEND_COUNTDOWN = 60;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const startCountdown = () => {
    setCountdown(RESEND_COUNTDOWN);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendVerificationCode(email, "reset_password");
      startCountdown();
      setStep("reset");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "验证码发送失败");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setError(null);
    setLoading(true);
    try {
      await sendVerificationCode(email, "reset_password");
      startCountdown();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "验证码发送失败");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("密码长度应至少 8 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email, code, newPassword);
      // 重置成功自动登录；按 username 决定是否还需 onboarding
      const username = getAuthState().user?.username;
      router.push(username ? "/app" : "/welcome");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "重置密码失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">重置密码</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {step === "email"
            ? "输入注册邮箱以接收验证码"
            : `验证码已发送至 ${email}`}
        </p>
      </div>

      {step === "email" ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="输入注册邮箱"
              required
              autoComplete="email"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "发送中…" : "发送验证码"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">验证码</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="输入 6 位验证码"
              required
              minLength={6}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">新密码</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="输入新密码（至少 8 位）"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认新密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "重置中…" : "重置密码"}
          </Button>

          <div className="flex justify-between text-sm">
            <button
              type="button"
              onClick={() => setStep("email")}
              className="text-muted-foreground hover:underline"
              disabled={loading}
            >
              更换邮箱
            </button>
            <button
              type="button"
              onClick={handleResend}
              className={
                countdown > 0
                  ? "text-muted-foreground cursor-not-allowed"
                  : "text-primary hover:underline"
              }
              disabled={countdown > 0 || loading}
            >
              {countdown > 0 ? `${countdown}s 后可重发` : "重新发送"}
            </button>
          </div>
        </form>
      )}

      <div className="text-center text-sm text-muted-foreground">
        想起密码了？{" "}
        <Link href="/login" className="text-primary hover:underline">
          返回登录
        </Link>
      </div>
    </Card>
  );
}
