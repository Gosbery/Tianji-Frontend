import { describe, expect, it } from "vitest";
import { humanizeAnswerText, parseAnswer, parseInline } from "@/lib/answer-format";

describe("parseAnswer", () => {
  it("recognizes headings, paragraphs, and ordered and unordered lists", () => {
    const blocks = parseAnswer([
      "## 结构判断",
      "这是**重点**。",
      "",
      "- 第一条",
      "- 第二条",
      "",
      "1. 先看日主",
      "2. 再看月令",
    ].join("\n"));

    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "list",
      "list",
    ]);
    expect(blocks[2]).toMatchObject({ type: "list", ordered: false });
    expect(blocks[3]).toMatchObject({ type: "list", ordered: true });
  });

  it("only marks complete bold pairs", () => {
    expect(parseInline("普通 **加粗** 未闭合 **文字")).toEqual([
      { text: "普通 ", bold: false },
      { text: "加粗", bold: true },
      { text: " 未闭合 **文字", bold: false },
    ]);
  });

  it("turns inline Chinese sections into readable headings and paragraphs", () => {
    const blocks = parseAnswer(
      "一、命盘事实：当前大运为辛亥 [1]。二、命理推演：下一步需要综合判断。三、结论：先看事业。",
    );

    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "heading",
      "paragraph",
      "heading",
      "paragraph",
    ]);
    expect(blocks[0]).toMatchObject({
      type: "heading",
      content: [{ text: "命盘事实", bold: false }],
    });
  });

  it("turns inline numbered points after punctuation into a list", () => {
    const blocks = parseAnswer("准备建议：1. 先完成储备；2. 再梳理财务；3. 最后复盘。");

    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "list"]);
    expect(blocks[1]).toMatchObject({ type: "list", ordered: true });
    if (blocks[1].type === "list") expect(blocks[1].items).toHaveLength(3);
  });

  it("moves a long parenthetical section note into the paragraph", () => {
    const blocks = parseAnswer(
      "一、事实：已核验。二、壬子运的命理推演（非程序事实，需整体看四柱，不能单抽一柱断事 [3]）：日主癸水。",
    );

    expect(blocks).toHaveLength(4);
    expect(blocks[2]).toMatchObject({
      type: "heading",
      content: [{ text: "壬子运的趋势分析", bold: false }],
    });
    expect(blocks[3]).toMatchObject({ type: "paragraph" });
  });

  it("does not split years or decimal numbers", () => {
    const blocks = parseAnswer("当前为2028.5年的观察值，不是列表。");

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
  });

  it("removes internal luck status enums from historical answers", () => {
    const text = humanizeAnswerText(
      "当前辛亥（2018—2027，状态current），下一步壬子（2028—2037，状态为future），庚戌（status=past）。",
    );

    expect(text).toBe("当前辛亥（2018—2027），下一步壬子（2028—2037），庚戌。 ".trim());
    expect(text).not.toMatch(/status|current|future|past/i);
  });

  it("hides internal reasoning sections and presents user-facing headings", () => {
    const blocks = parseAnswer([
      "一、命盘程序事实：日主癸水。",
      "二、候选依据与逐项检验：这是后台分析过程 [1]。",
      "三、分层判断（推演）：感情表达偏慢热。",
      "四、结论：先观察再确认关系。",
    ].join("\n\n"));
    const serialized = JSON.stringify(blocks);

    expect(serialized).not.toContain("候选依据");
    expect(serialized).not.toContain("后台分析过程");
    expect(serialized).not.toContain("程序事实");
    expect(serialized).not.toContain("推演");
    expect(serialized).toContain("命盘概况");
    expect(serialized).toContain("具体分析");
    expect(serialized).toContain("结论");
  });

  it("removes internal review and candidate wording from historical answers", () => {
    const text = humanizeAnswerText(
      "月令酉金偏印当令（machine_verified 候选，未定成格），感情推进偏慢。"
      + "偏印格候选为机器校勘候选，未定成格。整体仍需结合大运。",
    );

    expect(text).toContain("月令酉金偏印当令，感情推进偏慢");
    expect(text).toContain("整体仍需结合大运");
    expect(text).not.toMatch(/machine_verified|候选|未定成格|机器校勘/);
  });
});
