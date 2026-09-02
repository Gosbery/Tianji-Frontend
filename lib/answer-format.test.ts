import { describe, expect, it } from "vitest";
import { parseAnswer, parseInline } from "@/lib/answer-format";

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
});
