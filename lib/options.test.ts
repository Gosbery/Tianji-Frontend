import { describe, expect, it } from "vitest";
import { SCHOOL_OPTIONS } from "@/lib/options";

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
