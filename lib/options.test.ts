import { describe, expect, it } from "vitest";
import * as options from "@/lib/options";
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

  it("carries the backend topic fact pack id for every topic", () => {
    expect(Object.fromEntries(FORTUNE_TOPICS.map((topic) => [topic.id, topic.topicId]))).toEqual({
      overview: null,
      parents: "topic:family",
      siblings: "topic:family",
      network: "topic:social",
      romance: "topic:relationships",
      marriage: "topic:relationships",
      career: "topic:career",
      wealth: "topic:wealth",
      study: "topic:study",
      health: "topic:health",
      children: "topic:family",
      mobility: null,
      luck: "topic:luck-timing",
      risk: "topic:social",
    });
  });

  it("declares topicId on every entry, using null for topics without a fact pack", () => {
    for (const topic of FORTUNE_TOPICS) {
      expect(topic).toHaveProperty("topicId");
    }
    expect(FORTUNE_TOPICS.find((topic) => topic.id === "overview")?.topicId).toBeNull();
    expect(FORTUNE_TOPICS.find((topic) => topic.id === "mobility")?.topicId).toBeNull();
    expect(FORTUNE_TOPICS.find((topic) => topic.id === "wealth")?.topicId).toBe("topic:wealth");
    expect(FORTUNE_TOPICS.find((topic) => topic.id === "luck")?.topicId).toBe("topic:luck-timing");
  });
});

describe("retrieval mode options", () => {
  it("no longer offers a retrieval mode selector", () => {
    expect("RETRIEVAL_MODE_OPTIONS" in options).toBe(false);
    expect("retrievalModeDescription" in options).toBe(false);
  });
});
