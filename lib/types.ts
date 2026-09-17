export type BirthInput = {
  date: string;
  time: string;
  gender: "male" | "female";
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
  luck?: {
    direction: "forward" | "reverse";
    direction_label: "顺排" | "逆排";
    start_at: string;
    start_offset_years: number;
    start_offset_months: number;
    start_offset_days: number;
    start_offset_hours: number;
    method: string;
    cycles: LuckCycle[];
    current_cycle: LuckCycle | null;
    next_cycle: LuckCycle | null;
  };
  calculation_basis: string;
  uncertainties: string[];
};

export type LuckCycle = {
  index: number;
  ganzhi: string;
  stem: string;
  branch: string;
  start_year: number;
  end_year: number;
  start_age: number;
  end_age: number;
  status: "past" | "current" | "future";
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
  concepts: string[];
};

export type VerificationResult = {
  query: string;
  hits: Evidence[];
  latency_ms: number;
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
  policy_decision: string;
  citations_validated: boolean;
  degradation_reason: string;
  verification?: VerificationResult | null;
};

export type ConversationMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  turn_index: number;
  created_at: string;
  response: ChatResponse | null;
};

export type ConversationHistory = {
  session_id: string;
  chart_fingerprint: string;
  school: KnowledgeSchool;
  evidence_scope: EvidenceScope;
  messages: ConversationMessage[];
};

export type ExpertProfile = {
  id: string;
  display_name: string;
  version: string;
  review_status: "draft" | "machine_verified" | "reviewed" | "retired";
  allowed_schools: string[];
  preferred_schools: string[];
  methodology: string[];
  boundaries: string[];
  attribution: string;
  is_default: boolean;
};

export type ExpertList = {
  experts: ExpertProfile[];
  default_expert_id: string;
};

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type GenerationJob = {
  id: string;
  task_id: string;
  question: string;
  topic_id?: string | null;
  status: JobStatus;
  progress: string;
  error: string;
  assistant_message_id: string;
  attempt_count: number;
  recovery_count: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
};

export type ResearchTask = {
  id: string;
  title: string;
  expert_id: string;
  expert_version: string;
  expert_name: string;
  birth: BirthInput;
  chart: ChartFacts;
  school: string;
  evidence_scope: EvidenceScope;
  mode: RetrievalMode;
  archived: boolean;
  created_at: string;
  updated_at: string;
  active_job: GenerationJob | null;
};

export type ResearchTaskDetail = ResearchTask & {
  messages: ConversationMessage[];
};

export type TaskList = { tasks: ResearchTask[] };

// SSE 广播给所有订阅者，因此不携带问题或答案正文：只发驱动刷新的标识与状态，
// 正文由前端收到事件后重新 GET /tasks/{id} 获取。
export type TaskEventJob = Omit<GenerationJob, "question">;

export type TaskEvent = {
  type: string;
  task_id?: string;
  job?: TaskEventJob;
};

export type KnowledgeOverview = {
  layers: Record<string, number>;
  reviewed: Record<string, number>;
  machine_verified: Record<string, number>;
  retrieval_documents: number;
  preview_documents: number;
  schools: Record<string, { reviewed: number; machine_verified: number }>;
};

export type RetrievalMode = "direct";
export type EvidenceScope = "reviewed_only" | "personal_preview";
export const KNOWLEDGE_SCHOOLS = [
  "基础共识",
  "子平格局法",
  "其他用神体系",
  "文献整理",
  "版本研究",
] as const;
export type KnowledgeSchool = (typeof KNOWLEDGE_SCHOOLS)[number];
