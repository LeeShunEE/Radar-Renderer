/**
 * next/link 的测试替身（通过 vitest alias 注入）。
 *
 * 渲染为普通锚点，避免依赖 Next App Router 上下文。
 */
import type { ReactNode } from "react";

export default function Link({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return <a href={href}>{children}</a>;
}
