"use client";

import { BookOpen, ChevronDown } from "lucide-react";
import type { Evidence } from "@/lib/types";

type Props = {
  hits: Evidence[];
  loading?: boolean;
  error?: string;
};

export function VerificationList({ hits, loading, error }: Props) {
  if (loading) {
    return <div className="verification-list" role="status">正在检索典籍…</div>;
  }
  if (error) {
    return <div className="verification-list verification-error" role="alert">{error}</div>;
  }
  if (hits.length === 0) {
    return <div className="verification-list">未检索到相关典籍条文。</div>;
  }
  return (
    <div className="verification-list" aria-label="典籍依据">
      <p className="verification-heading">典籍依据 · {hits.length} 条</p>
      {hits.map((item, index) => (
        <details key={`${item.id}-${index}`} className="verification-item" open={index === 0}>
          <summary>
            <span className="verification-title">{item.title}</span>
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <div className="verification-body">
            <p>{item.quote}</p>
            <span className="verification-source">
              <BookOpen size={12} aria-hidden="true" />{item.source}
            </span>
          </div>
        </details>
      ))}
    </div>
  );
}
