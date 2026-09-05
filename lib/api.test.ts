import { afterEach, describe, expect, it, vi } from "vitest";
import { apiErrorMessage, askQuestion, calculateChart, sendFeedback } from "@/lib/api";

const birth = {
  date: "1990-01-01",
  time: "12:00",
  gender: "male" as const,
  timezone: "Asia/Shanghai",
  name: "访客",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiErrorMessage", () => {
  it("formats FastAPI validation arrays without object stringification", () => {
    expect(apiErrorMessage({
      detail: [
        { loc: ["body", "date"], msg: "日期超出范围" },
        { loc: ["body", "question"], msg: "问题太短" },
      ],
    }, 422)).toBe("date：日期超出范围；question：问题太短");
  });

  it("supports string and object details and falls back to the status", () => {
    expect(apiErrorMessage({ detail: "无效输入" }, 422)).toBe("无效输入");
    expect(apiErrorMessage({ detail: { message: "服务不可用" } }, 503)).toBe("服务不可用");
    expect(apiErrorMessage({ detail: { unexpected: true } }, 500)).toBe("请求失败 (500)");
  });
});

describe("request behavior", () => {
  it("consumes SSE chunks and returns the terminal chat response", async () => {
    const response = {
      session_id: "session-1",
      message_id: "message-1",
      answer: "流式回答",
      evidence: [],
      uncertainties: [],
      followups: [],
      mode: "hybrid_rerank",
      latency_ms: 10,
      token_usage: null,
      policy_decision: "allow",
      citations_validated: true,
      degradation_reason: "",
    };
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: start\ndata: {"type":"start"}\n\n'));
        controller.enqueue(encoder.encode(
          'event: progress\ndata: {"type":"progress","message":"正在检索相关资料"}\n\n',
        ));
        controller.enqueue(encoder.encode('event: chunk\ndata: {"type":"chunk","content":"流式"}\n\n'));
        controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ type: "done", response })}\n\n`));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const chunks: string[] = [];
    const progress: string[] = [];

    await expect(askQuestion({
      chart: {} as never,
      question: "测试问题",
      mode: "hybrid_rerank",
      evidenceScope: "reviewed_only",
      school: "基础共识",
      onChunk: (chunk) => chunks.push(chunk),
      onProgress: (message) => progress.push(message),
    })).resolves.toEqual(response);

    expect(chunks).toEqual(["流式"]);
    expect(progress).toEqual(["正在检索相关资料"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/chat/stream",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("keeps AbortError distinct from network failures", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    await expect(calculateChart(birth)).rejects.toBe(abortError);
  });

  it("turns fetch failures into an actionable local-service message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(calculateChart(birth)).rejects.toThrow("无法连接本地后端服务，请确认 API 已启动");
  });

  it("recognizes a same-origin proxy failure returned as plain text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
    }));

    await expect(calculateChart(birth)).rejects.toThrow(
      "无法连接本地后端服务，请确认 API 已启动",
    );
  });

  it("submits feedback with both message ownership fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    await sendFeedback("session-1", "assistant-1", -1, "引用不够清楚");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      session_id: "session-1",
      message_id: "assistant-1",
      rating: -1,
      note: "引用不够清楚",
    });
  });

  it("preserves the backend error code for session recovery", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      detail: "上下文不一致",
      code: "session_context_mismatch",
    }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    })));

    const request = askQuestion({
      chart: {} as never,
      question: "继续追问",
      sessionId: "old-session",
      mode: "hybrid",
      evidenceScope: "reviewed_only",
      school: "基础共识",
    });

    await expect(request).rejects.toMatchObject({
      status: 409,
      code: "session_context_mismatch",
    });
  });
});
