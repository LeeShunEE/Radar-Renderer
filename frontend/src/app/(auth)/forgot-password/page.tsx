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
import { useTranslations } from "next-intl";
import { getAuthState, resetPassword, sendVerificationCode } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

const RESEND_COUNTDOWN = 60;

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const tv = useTranslations("auth.verify");
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
      setError(err instanceof Error ? err.message : t("sendCodeFailed"));
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
      setError(err instanceof Error ? err.message : t("sendCodeFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email, code, newPassword);
      // 重置成功自动登录；按 username 决定是否还需 onboarding
      const username = getAuthState().user?.username;
      router.push(username ? "/app" : "/welcome");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("resetFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {step === "email"
            ? t("subtitleEmail")
            : tv("codeSent", { email })}
        </p>
      </div>

      {step === "email" ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              required
              autoComplete="email"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("sending") : t("sendCode")}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">{tv("codeLabel")}</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={tv("codePlaceholder")}
              required
              minLength={6}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t("newPasswordLabel")}</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("newPasswordPlaceholder")}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("confirmPasswordPlaceholder")}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("submitting") : t("submit")}
          </Button>

          <div className="flex justify-between text-sm">
            <button
              type="button"
              onClick={() => setStep("email")}
              className="text-muted-foreground hover:underline"
              disabled={loading}
            >
              {tv("changeEmail")}
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
              {countdown > 0
                ? tv("resendCountdown", { seconds: countdown })
                : tv("resend")}
            </button>
          </div>
        </form>
      )}

      <div className="text-center text-sm text-muted-foreground">
        {t("rememberedPassword")}{" "}
        <Link href="/login" className="text-primary hover:underline">
          {t("backToLogin")}
        </Link>
      </div>
    </Card>
  );
}
