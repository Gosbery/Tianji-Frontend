"use client";

import { BookOpen, ChevronDown, Database, Gauge } from "lucide-react";
import type { Evidence } from "@/lib/types";

type Props = {
  evidence: Evidence[];
  uncertainties: string[];
  latencyMs?: number;
};

export function EvidencePanel({ evidence, uncertainties, latencyMs }: Props) {
  return (
    <aside className="evidence-panel" aria-label="证据链">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">EVIDENCE</p>
          <h2>证据链</h2>
        </div>
        <span className="evidence-count">{evidence.length}</span>
      </div>

      {latencyMs !== undefined && (
        <div className="trace-summary">
          <Gauge size={15} />
          <span>{latencyMs} ms</span>
          <span>·</span>
          <span>{evidence.length} 条召回</span>
        </div>
      )}

      <div className="evidence-list">
        {evidence.length === 0 ? (
          <div className="empty-evidence"><Database size={20} /><span>等待一次检索</span></div>
        ) : (
          evidence.map((item, index) => (
            <details key={`${item.id}-${index}`} className="evidence-item" open={index === 0}>
              <summary>
                <span className="evidence-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="evidence-title">{item.title}</span>
                <ChevronDown size={15} />
              </summary>
              <div className="evidence-body">
                <p>{item.quote}</p>
                <div className="evidence-meta">
                  <span><BookOpen size={13} />{item.source}</span>
                  <span>{item.matched_by.join(" + ")}</span>
                  <span>{item.score.toFixed(4)}</span>
                </div>
              </div>
            </details>
          ))
        )}
      </div>

      {uncertainties.length > 0 && (
        <div className="uncertainty-block">
          <p>不确定性</p>
          {Array.from(new Set(uncertainties)).map((item) => <span key={item}>{item}</span>)}
        </div>
      )}
    </aside>
  );
}

