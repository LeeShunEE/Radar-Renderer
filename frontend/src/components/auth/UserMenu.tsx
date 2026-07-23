/**
 * UserMenu：顶栏用户名 + 登出按钮。
 */
"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function UserMenu() {
  const t = useTranslations("auth.userMenu");
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-foreground">
        {user.username}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="h-8 px-2"
      >
        <LogOut className="w-4 h-4 mr-1" />
        {t("logout")}
      </Button>
    </div>
  );
}