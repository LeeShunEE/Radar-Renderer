import { Metadata, Viewport } from "next";
import "../../styles/global.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/contexts/AuthContext";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "雷达图动画生成器",
  description: "基于 Remotion 的雷达图动画视频生成工具",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" className={cn("font-sans", geist.variable)}>
      <body className="bg-background">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}