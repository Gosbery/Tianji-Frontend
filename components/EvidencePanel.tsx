"use client";

import { BookOpen, ChevronDown, Database, Gauge, ShieldAlert } from "lucide-react";
import { EVIDENCE_KIND_LABELS, VERIFICATION_LABELS } from "@/lib/options";
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
          <Gauge size={15} aria-hidden="true" />
          <span>{latencyMs} ms</span>
          <span>·</span>
          <span>{evidence.length} 条召回</span>
        </div>
      )}

      <div className="evidence-list">
        {evidence.length === 0 ? (
          <div className="empty-evidence">
            <Database size={20} aria-hidden="true" />
            <span>等待一次检索</span>
          </div>
        ) : (
          evidence.map((item, index) => (
            <details key={`${item.id}-${index}`} className="evidence-item" open={index === 0}>
              <summary>
                <span className="evidence-index">{String(index + 1).padStart(2, "0")}</span>
                <span className={`evidence-kind kind-${item.kind}`}>
                  {EVIDENCE_KIND_LABELS[item.kind]}
                </span>
                <span className="evidence-title">{item.title}</span>
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <div className="evidence-body">
                {item.review_status === "machine_verified" && (
                  <div className="machine-evidence-heading">
                    <span className="machine-badge">
                      <ShieldAlert size={12} aria-hidden="true" />机器校勘
                    </span>
                    <span>置信度 {Math.round(item.confidence * 100)}%</span>
                  </div>
                )}
                <p>{item.quote}</p>
                {item.warning && <div className="evidence-warning">{item.warning}</div>}
                {item.unresolved_variants.length > 0 && (
                  <div className="variant-list">
                    <strong>未解决异文</strong>
                    {item.unresolved_variants.map((variant) => <span key={variant}>{variant}</span>)}
                  </div>
                )}
                <div className="evidence-meta">
                  <span>{item.layer ? `第 ${item.layer} 层` : "命盘事实"}</span>
                  <span><BookOpen size={13} aria-hidden="true" />{item.source}</span>
                  <span>{item.matched_by.join(" + ")}</span>
                  {item.trace_refs.length > 0 && <span>追溯 {item.trace_refs.length} 项</span>}
                  <span>{VERIFICATION_LABELS[item.verification_level]}</span>
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
