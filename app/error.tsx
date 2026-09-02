"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

export default function ErrorPage({
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
    <main className="route-state" role="alert">
      <TriangleAlert size={30} aria-hidden="true" />
      <h1>页面暂时无法显示</h1>
      <p>请重试本页；若问题持续出现，请稍后再打开。</p>
      <button type="button" className="secondary-button" onClick={retry}>
        <RefreshCw size={15} aria-hidden="true" />
        重试
      </button>
    </main>
  );
}
