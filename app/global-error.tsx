"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <title>页面错误 · 命盘显微镜</title>
        <main className="route-state" role="alert">
          <TriangleAlert size={30} aria-hidden="true" />
          <h1>应用暂时无法显示</h1>
          <p>请重试；若问题持续出现，请稍后重新打开。</p>
          <button type="button" className="secondary-button" onClick={retry}>
            <RefreshCw size={15} aria-hidden="true" />
            重试
          </button>
        </main>
      </body>
    </html>
  );
}
