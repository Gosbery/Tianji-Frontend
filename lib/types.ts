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
  calculation_basis: string;
  uncertainties: string[];
};

export type Evidence = {
  id: string;
  kind: "chart_fact" | "knowledge_card" | "source_passage";
  title: string;
  quote: string;
  source: string;
  score: number;
  matched_by: string[];
};

export type ChatResponse = {
  session_id: string;
  answer: string;
  evidence: Evidence[];
  uncertainties: string[];
  followups: string[];
  mode: string;
  latency_ms: number;
  token_usage: number | null;
};

export type RetrievalMode = "dense" | "hybrid" | "hybrid_rerank";

