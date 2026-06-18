/**
 * 注册页面：邮箱验证码两步注册。
 *
 * 步骤 1 输入邮箱并发送验证码；步骤 2 输入验证码完成注册。
 * 注册成功后跳转 /welcome 设置用户名（+ 密码）完成 onboarding。
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  registerWithCode,
  sendVerificationCode,
} from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

const RESEND_COUNTDOWN = 60;

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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
      await sendVerificationCode(email, "register");
      startCountdown();
      setStep("code");
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
      await sendVerificationCode(email, "register");
      startCountdown();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "验证码发送失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registerWithCode(email, code);
      // 邮箱注册用户 username 必空，统一进入 onboarding
      router.push("/welcome");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">注册</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {step === "email"
            ? "输入邮箱以接收验证码"
            : `验证码已发送至 ${email}，请检查收件箱或垃圾邮件`}
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
              placeholder="输入邮箱"
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
        <>
          <form onSubmit={handleRegister} className="space-y-4">
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

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "注册中…" : "注册"}
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

          <OAuthButtons />
          <p className="text-sm text-muted-foreground text-center">
            或使用 GitHub / Google 快捷登录
          </p>
        </>
      )}

      <div className="text-center text-sm text-muted-foreground">
        已有账户？{" "}
        <Link href="/login" className="text-primary hover:underline">
          登录
        </Link>
      </div>
    </Card>
  );
}
