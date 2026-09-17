import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatWorkspace, FormattedAnswer } from "@/components/ChatWorkspace";
import type { ChartFacts, ChatResponse } from "@/lib/types";

const chart: ChartFacts = {
  calculated_at: "2026-09-01T00:00:00Z",
  birth: {
    date: "1990-01-01",
    time: "12:00",
    gender: "male",
    timezone: "Asia/Shanghai",
    name: "访客",
  },
  pillars: [],
  day_master: "庚",
  day_master_element: "金",
  day_master_yin_yang: "阳",
  month_command: { branch: "子", main_hidden_stem: "癸", ten_god: "伤官" },
  exposed_stems: [],
  roots: [],
  structural_relations: [],
  pattern_candidates: [],
  luck: {
    direction: "forward",
    direction_label: "顺排",
    start_at: "1995-01-01T00:00:00",
    start_offset_years: 5,
    start_offset_months: 0,
    start_offset_days: 0,
    start_offset_hours: 0,
    method: "test",
    cycles: [],
    current_cycle: null,
    next_cycle: null,
  },
  calculation_basis: "test",
  uncertainties: [],
};

function response(sessionId: string, messageId: string, answer: string): ChatResponse {
  return {
    session_id: sessionId,
    message_id: messageId,
    answer,
    evidence: [{
      id: "evidence-1",
      kind: "knowledge_card",
      layer: 3,
      title: "测试依据",
      quote: "测试原文",
      source: "test",
      score: 1,
      matched_by: ["test"],
      trace_refs: [],
      review_status: "reviewed",
      verification_level: "human_review",
      confidence: 1,
      warning: "",
      unresolved_variants: [],
      concepts: ["正官"],
    }],
    uncertainties: [],
    followups: [],
    mode: "direct",
    latency_ms: 12,
    token_usage: 42,
    policy_decision: "allow",
    citations_validated: true,
    degradation_reason: "",
  };
}

function workspaceProps() {
  return {
    chart,
    evidenceScope: "reviewed_only" as const,
    suggestedQuestion: "",
    loading: false,
    onAsk: vi.fn(),
    onFeedback: vi.fn().mockResolvedValue(undefined),
    onResponseSelect: vi.fn(),
    onCitation: vi.fn(),
  };
}

describe("ChatWorkspace", () => {
  it("shows streamed analysis progress in the assistant message", async () => {
    const streamedResponse = response("session", "message", "最终回答");
    const onAsk = vi.fn().mockImplementation(async (
      _question: string,
      _topicId: string | null,
      onChunk?: (content: string) => void,
      onProgress?: (message: string) => void,
    ) => {
      onProgress?.("正在检索相关资料");
      onProgress?.("已检索到 6 条相关依据，正在组织分析");
      onChunk?.("最终回答");
      return streamedResponse;
    });
    render(<ChatWorkspace {...workspaceProps()} onAsk={onAsk} />);
    const textbox = screen.getByRole("textbox", { name: "问题" });

    fireEvent.change(textbox, { target: { value: "测试分析进度" } });
    fireEvent.submit(textbox.closest("form")!);

    expect(await screen.findByText("正在检索相关资料")).toBeDefined();
    expect(screen.getByText("已检索到 6 条相关依据，正在组织分析")).toBeDefined();
    expect(await screen.findByText("最终回答")).toBeDefined();
  });

  it("does not overwrite a draft when a pillar suggestion changes", () => {
    const props = workspaceProps();
    const { rerender } = render(<ChatWorkspace {...props} />);
    const textbox = screen.getByRole("textbox", { name: "问题" });
    fireEvent.change(textbox, { target: { value: "我正在输入的问题" } });

    rerender(<ChatWorkspace {...props} suggestedQuestion="建议追问" />);

    expect(textbox).toHaveProperty("value", "我正在输入的问题");
    fireEvent.click(screen.getByRole("button", { name: "建议追问" }));
    expect(textbox).toHaveProperty("value", "建议追问");
  });

  it("fills a complete question from a fortune topic without submitting it", () => {
    const onAsk = vi.fn();
    render(<ChatWorkspace {...workspaceProps()} onAsk={onAsk} />);

    fireEvent.click(screen.getByRole("button", { name: "父母助益" }));

    expect(screen.getByRole("textbox", { name: "问题" })).toHaveProperty(
      "value",
      expect.stringContaining("父母与原生家庭"),
    );
    expect(onAsk).not.toHaveBeenCalled();
  });

  it("submits the topic id of the tapped card together with the question", async () => {
    const onAsk = vi.fn().mockResolvedValue(response("session-topic", "message-topic", "财富回答"));
    render(<ChatWorkspace {...workspaceProps()} onAsk={onAsk} />);

    fireEvent.click(screen.getByRole("button", { name: "财富收入" }));
    fireEvent.submit(screen.getByRole("textbox", { name: "问题" }).closest("form")!);

    await screen.findByText("财富回答");
    expect(onAsk).toHaveBeenCalledWith(
      expect.stringContaining("财运"),
      "topic:wealth",
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("sends a null topic id for a free-form question", async () => {
    const onAsk = vi.fn().mockResolvedValue(response("session-free", "message-free", "自由回答"));
    render(<ChatWorkspace {...workspaceProps()} onAsk={onAsk} />);
    const textbox = screen.getByRole("textbox", { name: "问题" });

    fireEvent.change(textbox, { target: { value: "我想问点别的" } });
    fireEvent.submit(textbox.closest("form")!);

    await screen.findByText("自由回答");
    expect(onAsk).toHaveBeenCalledWith(
      "我想问点别的",
      null,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("clears the tapped topic so the next question is free-form again", async () => {
    const onAsk = vi.fn().mockResolvedValue(response("session-clear", "message-clear", "第一次回答"));
    render(<ChatWorkspace {...workspaceProps()} onAsk={onAsk} />);
    const textbox = screen.getByRole("textbox", { name: "问题" });

    fireEvent.click(screen.getByRole("button", { name: "财富收入" }));
    fireEvent.submit(textbox.closest("form")!);
    await screen.findByText("第一次回答");
    fireEvent.change(textbox, { target: { value: "再问一句" } });
    fireEvent.submit(textbox.closest("form")!);

    await waitFor(() => expect(onAsk).toHaveBeenCalledTimes(2));
    expect(onAsk).toHaveBeenLastCalledWith(
      "再问一句",
      null,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("drops the tapped topic when a followup suggestion replaces the question", async () => {
    const answered = {
      ...response("session-followup", "message-followup", "第一次回答"),
      followups: ["婚姻与伴侣怎么看？"],
    };
    const onAsk = vi.fn().mockResolvedValue(answered);
    render(<ChatWorkspace {...workspaceProps()} onAsk={onAsk} />);
    const textbox = screen.getByRole("textbox", { name: "问题" });

    fireEvent.change(textbox, { target: { value: "先随便问问" } });
    fireEvent.submit(textbox.closest("form")!);
    await screen.findByText("第一次回答");

    fireEvent.click(screen.getByRole("button", { name: "财富收入" }));
    fireEvent.click(screen.getByRole("button", { name: "婚姻与伴侣怎么看？" }));
    fireEvent.submit(textbox.closest("form")!);

    await waitFor(() => expect(onAsk).toHaveBeenCalledTimes(2));
    expect(onAsk).toHaveBeenLastCalledWith(
      "婚姻与伴侣怎么看？",
      null,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("drops the tapped topic when a pillar suggestion replaces the question", async () => {
    const onAsk = vi.fn().mockResolvedValue(response("session-suggestion", "message-suggestion", "建议回答"));
    render(
      <ChatWorkspace
        {...workspaceProps()}
        suggestedQuestion="日主甲辰在基础结构中应该怎样理解？"
        onAsk={onAsk}
      />,
    );
    const textbox = screen.getByRole("textbox", { name: "问题" });

    fireEvent.click(screen.getByRole("button", { name: "财富收入" }));
    fireEvent.click(screen.getByRole("button", { name: "日主甲辰在基础结构中应该怎样理解？" }));
    fireEvent.submit(textbox.closest("form")!);

    await screen.findByText("建议回答");
    expect(onAsk).toHaveBeenCalledWith(
      "日主甲辰在基础结构中应该怎样理解？",
      null,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("describes the expert and evidence scope without a retrieval mode", () => {
    const props = workspaceProps();
    render(<ChatWorkspace {...props} expertName="梁湘润方法 v0.1-preview" />);

    expect(screen.getByText(/梁湘润方法 v0\.1-preview · 仅人工审核/)).toBeDefined();
    expect(screen.queryByText(/混合检索/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Rerank" })).toBeNull();
  });

  it("offers the main topics users expect from a complete reading", () => {
    render(<ChatWorkspace {...workspaceProps()} />);

    for (const topic of [
      "全面总览",
      "父母助益",
      "兄弟姐妹",
      "朋友人脉",
      "桃花感情",
      "婚姻伴侣",
      "事业发展",
      "财富收入",
      "身心健康",
      "大运流年",
    ]) {
      expect(screen.getByRole("button", { name: topic })).toBeDefined();
    }
  });

  it("submits feedback against the selected response, not the latest response", async () => {
    const first = response("session-old", "message-old", "第一条回答");
    const second = response("session-new", "message-new", "第二条回答");
    const onAsk = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const onFeedback = vi.fn().mockResolvedValue(undefined);
    render(<ChatWorkspace {...workspaceProps()} onAsk={onAsk} onFeedback={onFeedback} />);
    const textbox = screen.getByRole("textbox", { name: "问题" });

    fireEvent.change(textbox, { target: { value: "第一个问题" } });
    fireEvent.submit(textbox.closest("form")!);
    await screen.findByText("第一条回答");
    fireEvent.change(textbox, { target: { value: "第二个问题" } });
    fireEvent.submit(textbox.closest("form")!);
    await screen.findByText("第二条回答");

    const helpfulButtons = screen.getAllByRole("button", { name: "有帮助" });
    fireEvent.click(helpfulButtons[0]);

    await waitFor(() => {
      expect(onFeedback).toHaveBeenCalledWith("session-old", "message-old", 1, "");
    });
    expect(helpfulButtons[0]).toHaveProperty("disabled", true);
  });

  it("scrolls the chat log itself when response state changes", async () => {
    const props = workspaceProps();
    const { rerender } = render(<ChatWorkspace {...props} />);
    const log = screen.getByRole("log");
    Object.defineProperty(log, "scrollHeight", { configurable: true, value: 480 });
    log.scrollTop = 0;

    rerender(<ChatWorkspace {...props} loading />);

    await waitFor(() => expect(log.scrollTop).toBe(480));
    expect(document.documentElement.scrollTop).toBe(0);
  });
});

describe("FormattedAnswer", () => {
  it("renders basic markdown structure semantically", () => {
    render(<FormattedAnswer text={"## 判断\n\n- **日主**\n- 月令"} />);

    expect(screen.getByRole("heading", { level: 3, name: "判断" })).toBeDefined();
    expect(screen.getByRole("list")).toBeDefined();
    expect(screen.getByText("日主").tagName).toBe("STRONG");
  });

  it("turns numeric citations into evidence controls", () => {
    const onCitation = vi.fn();
    render(<FormattedAnswer text="判断来自 [1]。" onCitation={onCitation} />);

    fireEvent.click(screen.getByRole("button", { name: "查看依据 1" }));

    expect(onCitation).toHaveBeenCalledWith(1);
  });
});
