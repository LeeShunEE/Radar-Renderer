/**
 * 消息目录一致性守卫：所有 locale 的 key 集必须与基准 locale（en）完全一致。
 *
 * 防止增量迁移时出现某语言漏译 / 多余 key。key 用点号路径扁平化后比对。
 * 同时校验 ICU 占位符（{name}）在各语言间一致，避免插值参数错配。
 */
import { describe, it, expect } from "vitest";
import { locales, defaultLocale } from "@/i18n/config";
import en from "../../../../frontend/messages/en.json";
import zh from "../../../../frontend/messages/zh.json";

type Json = { [key: string]: string | Json };

const catalogs: Record<string, Json> = { en, zh };

/** 递归收集所有叶子 key 的点号路径。 */
function flattenKeys(obj: Json, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : flattenKeys(value, path);
  });
}

/** 取某点号路径对应的字符串（用于占位符比对）。 */
function getMessage(obj: Json, path: string): string {
  let cur: string | Json = obj;
  for (const part of path.split(".")) {
    cur = (cur as Json)[part];
  }
  return cur as string;
}

/** 提取消息中的 {name} 占位符集合（排序去重）。 */
function placeholders(message: string): string[] {
  return [...new Set(message.match(/\{(\w+)\}/g) ?? [])].sort();
}

describe("messages catalogs", () => {
  const baseKeys = flattenKeys(catalogs[defaultLocale]).sort();

  it("测试目录覆盖了 config 声明的全部 locale", () => {
    for (const locale of locales) {
      expect(catalogs[locale], `缺少 ${locale} 目录`).toBeTruthy();
    }
  });

  for (const locale of locales.filter((l) => l !== defaultLocale)) {
    it(`${locale} 的 key 集与 ${defaultLocale} 完全一致`, () => {
      const keys = flattenKeys(catalogs[locale]).sort();
      expect(keys).toEqual(baseKeys);
    });

    it(`${locale} 的 ICU 占位符与 ${defaultLocale} 一致`, () => {
      for (const key of baseKeys) {
        expect(
          placeholders(getMessage(catalogs[locale], key)),
          `${key} 占位符不一致`,
        ).toEqual(placeholders(getMessage(catalogs[defaultLocale], key)));
      }
    });
  }
});
