/**
 * next-intl 的单元测试替身（单元测试不挂载 Next 请求上下文 / getRequestConfig）。
 *
 * 用真实 zh.json 作为消息源：既让被测组件拿到真实文案（保持既有中文断言可用），
 * 又能在引用了不存在的 key 时暴露问题（回落为 key 路径而非崩溃）。
 * useLocale 固定返回 "zh"，与消息源一致。
 */
import React from "react";
import zh from "../../../messages/zh.json";

type Json = { [key: string]: string | Json };

/** 按 "ns.key" 路径在 zh.json 中取字符串；缺失则回落为路径本身（便于定位漏 key）。 */
function lookup(namespace: string, key: string): string {
  const full = namespace ? `${namespace}.${key}` : key;
  let cur: string | Json = zh as Json;
  for (const part of full.split(".")) {
    if (typeof cur !== "object" || cur === null) return full;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : full;
}

/** 极简 ICU：仅替换 {name} 占位符，够覆盖本仓消息（{email} / {seconds}）。 */
function interpolate(message: string, values?: Record<string, unknown>): string {
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in values ? String(values[name]) : `{${name}}`,
  );
}

export function useTranslations(namespace = "") {
  return (key: string, values?: Record<string, unknown>) =>
    interpolate(lookup(namespace, key), values);
}

export function useLocale(): string {
  return "zh";
}

export function NextIntlClientProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  return children;
}
