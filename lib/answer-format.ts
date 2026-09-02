export type InlinePart = {
  text: string;
  bold: boolean;
};

export type AnswerBlock =
  | { type: "heading"; content: InlinePart[] }
  | { type: "paragraph"; content: InlinePart[] }
  | { type: "list"; ordered: boolean; items: InlinePart[][] };

export function parseInline(text: string): InlinePart[] {
  return text
    .split(/(\*\*[^*\n]+\*\*)/g)
    .filter(Boolean)
    .map((part) => {
      const bold = part.startsWith("**") && part.endsWith("**");
      return { text: bold ? part.slice(2, -2) : part, bold };
    });
}

export function parseAnswer(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: InlinePart[][] } | null = null;

  function flushParagraph() {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", content: parseInline(paragraph.join("\n")) });
      paragraph = [];
    }
  }

  function flushList() {
    if (list) {
      blocks.push({ type: "list", ordered: list.ordered, items: list.items });
      list = null;
    }
  }

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    const listItem = line.match(/^\s*(?:(\d+)[.)]|[-*+])\s+(.+)$/);

    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", content: parseInline(heading[1]) });
      continue;
    }

    if (listItem) {
      flushParagraph();
      const ordered = Boolean(listItem[1]);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push(parseInline(listItem[2]));
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}
