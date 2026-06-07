/**
 * AuthContext：提供 useAuth hook 访问认证状态与方法。
 */
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  getAuthState,
  subscribe,
  initializeAuth,
  login as doLogin,
  register as doRegister,
  logout as doLogout,
  refreshTokens as doRefresh,
} from "@/lib/auth-store";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(getAuthState());

  useEffect(() => {
    const unsubscribe = subscribe(setState);
    initializeAuth();
    return unsubscribe;
  }, []);

  const value: AuthContextValue = {
    user: state.user,
    loading: state.loading,
    error: state.error,
    login: doLogin,
    register: doRegister,
    logout: doLogout,
    refreshTokens: doRefresh,
    isAuthenticated: !!state.user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}