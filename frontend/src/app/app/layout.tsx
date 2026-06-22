/**
 * 应用布局：AuthGuard + 顶栏（UserMenu）+ 底部版本号页脚。
 */
"use client";

import React from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { UserMenu } from "@/components/auth/UserMenu";
import { Footer } from "@/components/layout/Footer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-unfocused-border-color px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">
            雷达图动画生成器
          </h1>
          <UserMenu />
        </header>
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
    </AuthGuard>
  );
}