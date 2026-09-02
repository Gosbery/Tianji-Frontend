import { afterEach, describe, expect, it, vi } from "vitest";
import { apiErrorMessage, calculateChart, sendFeedback } from "@/lib/api";

const birth = {
  date: "1990-01-01",
  time: "12:00",
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
});
