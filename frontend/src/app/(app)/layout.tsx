/**
 * 应用布局：AuthGuard + 顶栏（UserMenu）。
 */
"use client";

import React from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { UserMenu } from "@/components/auth/UserMenu";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <header className="border-b border-unfocused-border-color px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">
            雷达图动画生成器
          </h1>
          <UserMenu />
        </header>
        {children}
      </div>
    </AuthGuard>
  );
}