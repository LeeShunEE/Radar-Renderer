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
import { useTranslations } from "next-intl";
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
  const t = useTranslations("auth.register");
  const tv = useTranslations("auth.verify");
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
      await sendVerificationCode(email, "register");
      startCountdown();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("sendCodeFailed"));
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
      setError(err instanceof Error ? err.message : t("registerFailed"));
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
        <>
          <form onSubmit={handleRegister} className="space-y-4">
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

          <OAuthButtons />
          <p className="text-sm text-muted-foreground text-center">
            {t("oauthHint")}
          </p>
        </>
      )}

      <div className="text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/login" className="text-primary hover:underline">
          {t("loginLink")}
        </Link>
      </div>
    </Card>
  );
}
