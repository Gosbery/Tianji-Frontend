import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "命盘显微镜",
  description: "可追溯的八字知识与对话实验室",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

