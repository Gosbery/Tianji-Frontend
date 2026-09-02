import { KNOWLEDGE_SCHOOLS } from "@/lib/types";
import type { Evidence, RetrievalMode } from "@/lib/types";

export const RETRIEVAL_MODE_OPTIONS: ReadonlyArray<{
  value: RetrievalMode;
  label: string;
  description: string;
}> = [
  { value: "dense", label: "Dense", description: "向量召回" },
  { value: "hybrid", label: "Hybrid", description: "混合检索" },
  { value: "hybrid_rerank", label: "Rerank", description: "混合检索 + 重排" },
];

export const SCHOOL_OPTIONS = KNOWLEDGE_SCHOOLS.map((value) => ({ value, label: value }));

export const EVIDENCE_KIND_LABELS: Record<Evidence["kind"], string> = {
  chart_fact: "命盘",
  knowledge_card: "知识卡",
  modern_annotation: "注释",
  canonical_passage: "原典",
  source_passage: "来源",
};

export const VERIFICATION_LABELS: Record<Evidence["verification_level"], string> = {
  unverified: "未核验",
  single_source_integrity: "单源完整性",
  multi_source_alignment: "多源对齐",
  human_review: "人工复核",
};

export function retrievalModeDescription(mode: RetrievalMode): string {
  return RETRIEVAL_MODE_OPTIONS.find((option) => option.value === mode)?.description ?? mode;
}
