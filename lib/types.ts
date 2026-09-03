export type BirthInput = {
  date: string;
  time: string;
  timezone: string;
  name: string;
};

export type Pillar = {
  key: "year" | "month" | "day" | "time";
  label: string;
  stem: string;
  branch: string;
  stem_element: string;
  stem_yin_yang: string;
  branch_element: string;
  hidden_stems: string[];
  ten_god_stem: string;
  ten_god_branches: string[];
  nayin: string;
};

export type ChartFacts = {
  calculated_at: string;
  birth: BirthInput;
  pillars: Pillar[];
  day_master: string;
  day_master_element: string;
  day_master_yin_yang: string;
  month_command: {
    branch: string;
    main_hidden_stem: string;
    ten_god: string;
  };
  exposed_stems: Array<{
    hidden_stem: string;
    hidden_positions: string[];
    visible_positions: string[];
    outside_day_master: boolean;
  }>;
  roots: Array<{
    stem: string;
    stem_position: string;
    branch: string;
    branch_position: string;
    hidden_stem: string;
    relation: "same_stem" | "same_element";
  }>;
  structural_relations: Array<{
    kind:
      | "stem_combination"
      | "branch_combination"
      | "branch_clash"
      | "branch_harm"
      | "branch_punishment"
      | "three_harmony"
      | "seasonal_meeting";
    label: string;
    members: string[];
    positions: string[];
    completeness: "pair" | "partial" | "full";
    note: string;
  }>;
  pattern_candidates: Array<{
    name: string;
    ten_god: string;
    source_stem: string;
    basis: "month_main_qi" | "month_hidden_stem_exposed";
    exposed_positions: string[];
    note: string;
  }>;
  calculation_basis: string;
  uncertainties: string[];
};

export type Evidence = {
  id: string;
  kind:
    | "chart_fact"
    | "knowledge_card"
    | "modern_annotation"
    | "canonical_passage"
    | "source_passage";
  layer: 1 | 2 | 3 | null;
  title: string;
  quote: string;
  source: string;
  score: number;
  matched_by: string[];
  trace_refs: string[];
  review_status: "draft" | "machine_verified" | "reviewed" | "retired";
  verification_level:
    | "unverified"
    | "single_source_integrity"
    | "multi_source_alignment"
    | "human_review";
  confidence: number;
  warning: string;
  unresolved_variants: string[];
};

export type ChatResponse = {
  session_id: string;
  message_id: string;
  answer: string;
  evidence: Evidence[];
  uncertainties: string[];
  followups: string[];
  mode: string;
  latency_ms: number;
  token_usage: number | null;
};

export type RetrievalMode = "dense" | "hybrid" | "hybrid_rerank";
export type EvidenceScope = "reviewed_only" | "personal_preview";
export const KNOWLEDGE_SCHOOLS = [
  "基础共识",
  "子平格局法",
  "其他用神体系",
  "文献整理",
  "版本研究",
] as const;
export type KnowledgeSchool = (typeof KNOWLEDGE_SCHOOLS)[number];
