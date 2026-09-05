import { KNOWLEDGE_SCHOOLS } from "@/lib/types";
import type { Evidence, RetrievalMode } from "@/lib/types";

export type FortuneTopic = {
  id: string;
  label: string;
  question: string;
};

export const FORTUNE_TOPICS: ReadonlyArray<FortuneTopic> = [
  {
    id: "overview",
    label: "全面总览",
    question: "请全面分析我的命盘，依次说明性格优势与短板、父母助益、兄弟姐妹、朋友人脉、桃花感情、婚姻、子女、学业、事业、财运、健康、迁移置业、贵人与风险，并结合当前及下一步大运说明各主题的变化。",
  },
  {
    id: "parents",
    label: "父母助益",
    question: "请分析父母与原生家庭对我的助益、相处模式和可能的压力，分别说明命盘依据，并结合当前大运判断变化。",
  },
  {
    id: "siblings",
    label: "兄弟姐妹",
    question: "请分析我与兄弟姐妹或同辈手足的缘分、互助与竞争倾向，并说明命盘依据和大运变化。",
  },
  {
    id: "network",
    label: "朋友人脉",
    question: "请分析我的朋友、人脉、合作伙伴与贵人运，说明哪些关系更有助益、哪些容易带来竞争或消耗，并结合大运判断。",
  },
  {
    id: "romance",
    label: "桃花感情",
    question: "请分析我的桃花、恋爱机会、吸引力与感情相处模式，并结合当前及下一步大运说明较明显的阶段。",
  },
  {
    id: "marriage",
    label: "婚姻伴侣",
    question: "请分析我的婚姻倾向、伴侣特征、关系中的优势与风险，并结合当前及下一步大运判断变化。",
  },
  {
    id: "career",
    label: "事业发展",
    question: "请分析我的事业方向、职场优势、职位发展、创业或受雇倾向，并结合当前及下一步大运判断机会与风险。",
  },
  {
    id: "wealth",
    label: "财富收入",
    question: "请分析我的财运、收入方式、积累能力、合作求财与破财风险，并结合当前及下一步大运判断变化。",
  },
  {
    id: "study",
    label: "学业考试",
    question: "请分析我的学习方式、学业与考试表现、适合深造的方向，并结合当前大运说明有利与不利阶段。",
  },
  {
    id: "health",
    label: "身心健康",
    question: "请从命理角度分析我的身心健康倾向、需要留意的阶段与生活习惯，并结合当前及下一步大运说明。",
  },
  {
    id: "children",
    label: "子女后代",
    question: "请分析我的子女缘、与晚辈的相处方式和养育倾向，并结合大运说明可能的变化。",
  },
  {
    id: "mobility",
    label: "迁移置业",
    question: "请分析我的异地发展、迁移变动、出行和置业倾向，并结合当前及下一步大运判断机会与风险。",
  },
  {
    id: "luck",
    label: "大运流年",
    question: "请先说明程序计算的起运、当前大运和下一步大运，再分析两步大运对事业、财运、感情、家庭与健康的影响。",
  },
  {
    id: "risk",
    label: "贵人与风险",
    question: "请分析我的贵人来源、容易得到帮助的场景，以及人际、事业、财富和感情中需要防范的风险，并结合大运说明。",
  },
];

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
