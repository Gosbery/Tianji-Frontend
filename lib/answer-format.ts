export type InlinePart = {
  text: string;
  bold: boolean;
};

export type AnswerBlock =
  | { type: "heading"; content: InlinePart[] }
  | { type: "paragraph"; content: InlinePart[] }
  | { type: "list"; ordered: boolean; items: InlinePart[][] };

export function humanizeAnswerText(text: string): string {
  return text
    .replace(/\bpattern_candidates\b/gi, "格局参考")
    .replace(
      /[（(][^（）()\n]*(?:machine_verified|机器校勘|未定成格)[^（）()\n]*[）)]/gi,
      "",
    )
    .replace(
      /(^|[。！？])[^。！？\n]*(?:machine_verified|机器校勘)[^。！？\n]*[。！？]?/gi,
      "$1",
    )
    .replace(
      /(?:[,，;；]\s*)?(?:状态|status)\s*(?:为|是|[:：=])?\s*(?:current|future|past)\b/gi,
      "",
    )
    .replace(/\bcurrent_cycle\b/gi, "当前大运")
    .replace(/\bnext_cycle\b/gi, "下一步大运")
    .replace(/未定成格|(?:结构关系)?候选/g, "")
    .replace(/[（(]\s*[）)]/g, "")
    .replace(/([，；])\s*[，；]/g, "$1");
}

export function parseInline(text: string): InlinePart[] {
  return humanizeAnswerText(text)
    .split(/(\*\*[^*\n]+\*\*)/g)
    .filter(Boolean)
    .map((part) => {
      const bold = part.startsWith("**") && part.endsWith("**");
      return { text: bold ? part.slice(2, -2) : part, bold };
    });
}

function normalizeAnswerLayout(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(
      /([。；！？])\s*(?=[一二三四五六七八九十]+[、.]\s*[^：:\n]{1,80}[：:])/g,
      "$1\n\n",
    )
    .replace(/([：；。])\s*(?=(?:[1-9]|10)[.)、]\s+)/g, "$1\n");
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

  for (const rawLine of normalizeAnswerLayout(text).split("\n")) {
    const line = rawLine.trimEnd();
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    const chineseSection = line.match(
      /^\s*([一二三四五六七八九十]+)[、.]\s*([^：:\n]{1,80})[：:]\s*(.*)$/,
    );
    const listItem = line.match(/^\s*(?:(\d+)[.)]|[-*+])\s+(.+)$/);

    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", content: parseInline(heading[1]) });
      continue;
    }

    if (chineseSection) {
      flushParagraph();
      flushList();
      let sectionTitle = chineseSection[2];
      let sectionBody = chineseSection[3];
      const noteStart = sectionTitle.search(/[（(]/);
      if (sectionTitle.length > 28 && noteStart >= 4 && noteStart <= 24) {
        const note = sectionTitle.slice(noteStart);
        sectionTitle = sectionTitle.slice(0, noteStart);
        sectionBody = `${note}${sectionBody ? `：${sectionBody}` : ""}`;
      }
      blocks.push({
        type: "heading",
        content: parseInline(`${chineseSection[1]}、${sectionTitle}`),
      });
      if (sectionBody) paragraph.push(sectionBody);
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
  return prepareBlocksForDisplay(blocks);
}

function prepareBlocksForDisplay(blocks: AnswerBlock[]): AnswerBlock[] {
  const visible: AnswerBlock[] = [];
  let hideUntilNextHeading = false;

  for (const block of blocks) {
    if (block.type !== "heading") {
      if (!hideUntilNextHeading) visible.push(block);
      continue;
    }

    const original = block.content.map((part) => part.text).join("");
    const heading = original.replace(/^[一二三四五六七八九十]+[、.]\s*/, "");
    hideUntilNextHeading = /候选.*(?:依据|检验)|逐项(?:检验|套用)|条件套用|检查与推演|推理过程/.test(
      heading,
    );
    if (hideUntilNextHeading) continue;

    const label = heading
      .replace(/^命盘程序事实$/, "命盘概况")
      .replace(/^分层判断(?:（推演）)?$/, "具体分析")
      .replace(/命理推演/g, "趋势分析")
      .replace(/推演/g, "分析");
    visible.push({ type: "heading", content: parseInline(label) });
  }

  return visible;
}
