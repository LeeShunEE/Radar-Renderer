/**
 * 认证页面布局：居中卡片，无侧栏。
 */
"use client";

import React from "react";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}