import { describe, expect, it } from "vitest";
import { FORTUNE_TOPICS, SCHOOL_OPTIONS } from "@/lib/options";

describe("SCHOOL_OPTIONS", () => {
  it("covers every school currently modeled by the knowledge base", () => {
    expect(SCHOOL_OPTIONS.map((option) => option.value)).toEqual([
      "基础共识",
      "子平格局法",
      "其他用神体系",
      "文献整理",
      "版本研究",
    ]);
  });
});

describe("FORTUNE_TOPICS", () => {
  it("has stable ids and complete, non-empty questions", () => {
    expect(new Set(FORTUNE_TOPICS.map((topic) => topic.id)).size).toBe(FORTUNE_TOPICS.length);
    expect(FORTUNE_TOPICS.every((topic) => topic.label && topic.question.endsWith("。"))).toBe(true);
  });
});
