import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatWorkspace, FormattedAnswer } from "@/components/ChatWorkspace";
import type { ChartFacts, ChatResponse } from "@/lib/types";

const chart: ChartFacts = {
  calculated_at: "2026-09-01T00:00:00Z",
  birth: {
    date: "1990-01-01",
    time: "12:00",
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
  calculation_basis: "test",
  uncertainties: [],
};

function response(sessionId: string, messageId: string, answer: string): ChatResponse {
  return {
    session_id: sessionId,
    message_id: messageId,
    answer,
    evidence: [],
    uncertainties: [],
    followups: [],
    mode: "hybrid_rerank",
    latency_ms: 12,
    token_usage: 42,
  };
}

function workspaceProps() {
  return {
    chart,
    mode: "hybrid_rerank" as const,
    school: "基础共识" as const,
    evidenceScope: "reviewed_only" as const,
    suggestedQuestion: "",
    loading: false,
    onAsk: vi.fn(),
    onFeedback: vi.fn().mockResolvedValue(undefined),
    onSchoolChange: vi.fn(),
  };
}

describe("ChatWorkspace", () => {
  it("shows streamed analysis progress in the assistant message", async () => {
    const streamedResponse = response("session", "message", "最终回答");
    const onAsk = vi.fn().mockImplementation(async (
      _question: string,
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
});
