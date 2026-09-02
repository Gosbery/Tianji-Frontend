import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "命盘显微镜 · 墨韵玄机",
  description: "可追溯的八字知识与对话实验室 · 以墨绿为底，玄金为纹",
};

export const viewport: Viewport = {
  themeColor: "#0a120d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

