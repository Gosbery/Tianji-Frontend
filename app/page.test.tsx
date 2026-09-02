import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { askQuestion, calculateChart, sendFeedback } from "@/lib/api";
import type { ChartFacts, ChatResponse, Pillar } from "@/lib/types";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    askQuestion: vi.fn(),
    calculateChart: vi.fn(),
    sendFeedback: vi.fn(),
  };
});

const calculateChartMock = vi.mocked(calculateChart);
const askQuestionMock = vi.mocked(askQuestion);
const sendFeedbackMock = vi.mocked(sendFeedback);

function pillar(key: Pillar["key"], label: string, stem: string, branch: string): Pillar {
  return {
    key,
    label,
    stem,
    branch,
    stem_element: stem === "甲" ? "木" : "金",
    stem_yin_yang: "阳",
    branch_element: "水",
    hidden_stems: ["癸"],
    ten_god_stem: key === "day" ? "" : "比肩",
    ten_god_branches: ["伤官"],
    nayin: "测试纳音",
  };
}

function chart(dayMaster: string, date = "1990-01-01"): ChartFacts {
  return {
    calculated_at: "2026-09-01T00:00:00Z",
    birth: { date, time: "12:00", timezone: "Asia/Shanghai", name: "访客" },
    pillars: [
      pillar("year", "年柱", "庚", "午"),
      pillar("month", "月柱", "戊", "子"),
      pillar("day", "日柱", dayMaster, "辰"),
      pillar("time", "时柱", "壬", "午"),
    ],
    day_master: dayMaster,
    day_master_element: dayMaster === "甲" ? "木" : "金",
    day_master_yin_yang: "阳",
    calculation_basis: "test",
    uncertainties: [],
  };
}

function response(sessionId: string, messageId: string, answer: string): ChatResponse {
  return {
    session_id: sessionId,
    message_id: messageId,
    answer,
    evidence: [],
    uncertainties: [],
    followups: [],
    mode: "hybrid_rerank",
    latency_ms: 10,
    token_usage: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  calculateChartMock.mockReset();
  askQuestionMock.mockReset();
  sendFeedbackMock.mockReset();
});

describe("Home request state", () => {
  it("cancels the default chart when birth input changes during initial loading", async () => {
    const initial = deferred<ChartFacts>();
    calculateChartMock.mockImplementationOnce(() => initial.promise);
    render(<Home />);
    await waitFor(() => expect(calculateChartMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("出生日期"), { target: { value: "1994-04-04" } });
    expect(calculateChartMock.mock.calls[0][1]?.aborted).toBe(true);
    expect(screen.getByRole("button", { name: "重新排盘" })).toBeDefined();
    initial.resolve(chart("庚"));

    await waitFor(() => expect(screen.queryByText("已计算")).toBeNull());
    calculateChartMock.mockResolvedValueOnce(chart("甲", "1994-04-04"));
    fireEvent.click(screen.getByRole("button", { name: "重新排盘" }));
    await screen.findByText("已计算");
  });

  it("resets the conversation and session after a successful chart change", async () => {
    calculateChartMock.mockResolvedValueOnce(chart("庚"));
    askQuestionMock
      .mockResolvedValueOnce(response("session-old", "message-old", "旧命盘回答"))
      .mockResolvedValueOnce(response("session-new", "message-new", "新命盘回答"));
    render(<Home />);

    await screen.findByText("已计算");
    const question = screen.getByRole("textbox", { name: "问题" });
    fireEvent.change(question, { target: { value: "旧命盘问题" } });
    fireEvent.submit(question.closest("form")!);
    await screen.findByText("旧命盘回答");

    calculateChartMock.mockResolvedValueOnce(chart("甲", "1991-02-03"));
    fireEvent.change(screen.getByLabelText("出生日期"), { target: { value: "1991-02-03" } });
    expect(screen.getByRole("textbox", { name: "问题" })).toHaveProperty("disabled", true);
    expect(screen.getByText("出生信息已修改，请先重新排盘")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "重新排盘" }));

    await waitFor(() => expect(screen.queryByText("旧命盘回答")).toBeNull());
    const resetQuestion = screen.getByRole("textbox", { name: "问题" });
    fireEvent.change(resetQuestion, { target: { value: "新命盘问题" } });
    fireEvent.submit(resetQuestion.closest("form")!);
    await screen.findByText("新命盘回答");

    expect(askQuestionMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        chart: expect.objectContaining({ day_master: "甲" }),
        sessionId: undefined,
      }),
      expect.any(AbortSignal),
    );
  });

  it("aborts the older chart request and ignores a late result", async () => {
    calculateChartMock.mockResolvedValueOnce(chart("庚"));
    render(<Home />);
    await screen.findByText("已计算");

    const older = deferred<ChartFacts>();
    const newer = deferred<ChartFacts>();
    calculateChartMock
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise);
    const form = screen.getByLabelText("出生日期").closest("form")!;

    fireEvent.change(screen.getByLabelText("出生日期"), { target: { value: "1991-01-01" } });
    fireEvent.submit(form);
    fireEvent.change(screen.getByLabelText("出生日期"), { target: { value: "1992-01-01" } });
    fireEvent.submit(form);

    const olderSignal = calculateChartMock.mock.calls[1][1];
    expect(olderSignal?.aborted).toBe(true);
    newer.resolve(chart("甲", "1992-01-01"));
    await screen.findAllByText("甲");
    older.resolve(chart("乙", "1991-01-01"));

    await waitFor(() => {
      expect(screen.queryAllByText("乙")).toHaveLength(0);
      expect(screen.getAllByText("甲").length).toBeGreaterThan(0);
    });
  });

  it("keeps a failed replacement chart read-only for conversation", async () => {
    calculateChartMock.mockResolvedValueOnce(chart("庚"));
    render(<Home />);
    await screen.findByText("已计算");

    fireEvent.change(screen.getByLabelText("出生日期"), { target: { value: "1993-01-01" } });
    calculateChartMock.mockRejectedValueOnce(new Error("排盘服务失败"));
    fireEvent.click(screen.getByRole("button", { name: "重新排盘" }));

    await screen.findByRole("alert");
    expect(screen.getByText("待重新计算")).toBeDefined();
    expect(screen.getByText("出生信息已修改，请先重新排盘")).toBeDefined();
    expect(screen.getByRole("textbox", { name: "问题" })).toHaveProperty("disabled", true);
    expect(screen.getAllByText("庚").length).toBeGreaterThan(0);
  });

  it("locks retrieval settings during a request and clears stale evidence after a change", async () => {
    calculateChartMock.mockResolvedValueOnce(chart("庚"));
    const pending = deferred<ChatResponse>();
    askQuestionMock.mockImplementationOnce(() => pending.promise);
    render(<Home />);

    await screen.findByText("已计算");
    const question = screen.getByRole("textbox", { name: "问题" });
    fireEvent.change(question, { target: { value: "测试检索设置" } });
    fireEvent.submit(question.closest("form")!);

    expect(screen.getByRole("button", { name: "Dense" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("switch", { name: "纳入机器校勘资料" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("combobox", { name: "知识流派" })).toHaveProperty("disabled", true);

    pending.resolve({ ...response("session", "message", "设置回答"), latency_ms: 321 });
    await screen.findByText("设置回答");
    expect(screen.getByText("321 ms")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Dense" }));
    expect(screen.queryByText("321 ms")).toBeNull();
  });

  it("routes historical feedback with that answer's session and message ids", async () => {
    calculateChartMock.mockResolvedValueOnce(chart("庚"));
    askQuestionMock
      .mockResolvedValueOnce(response("session-old", "message-old", "第一条回答"))
      .mockResolvedValueOnce(response("session-new", "message-new", "第二条回答"));
    sendFeedbackMock.mockResolvedValueOnce(undefined);
    render(<Home />);

    await screen.findByText("已计算");
    const question = screen.getByRole("textbox", { name: "问题" });
    fireEvent.change(question, { target: { value: "第一个问题" } });
    fireEvent.submit(question.closest("form")!);
    await screen.findByText("第一条回答");
    fireEvent.change(question, { target: { value: "第二个问题" } });
    fireEvent.submit(question.closest("form")!);
    await screen.findByText("第二条回答");

    fireEvent.click(screen.getAllByRole("button", { name: "有帮助" })[0]);

    await waitFor(() => {
      expect(sendFeedbackMock).toHaveBeenCalledWith(
        "session-old",
        "message-old",
        1,
        "",
      );
    });
  });

  it("ignores a pending chat response that arrives after birth input changes", async () => {
    calculateChartMock.mockResolvedValueOnce(chart("庚"));
    const pending = deferred<ChatResponse>();
    askQuestionMock.mockImplementationOnce(() => pending.promise);
    render(<Home />);

    await screen.findByText("已计算");
    const question = screen.getByRole("textbox", { name: "问题" });
    fireEvent.change(question, { target: { value: "待处理问题" } });
    fireEvent.submit(question.closest("form")!);
    await screen.findByText("待处理问题");

    const signal = askQuestionMock.mock.calls[0][1];
    fireEvent.change(screen.getByLabelText("出生日期"), {
      target: { value: "1995-05-05" },
    });
    expect(signal?.aborted).toBe(true);
    pending.resolve(response("late-session", "late-message", "不应出现的晚到回答"));

    await waitFor(() => expect(screen.queryByText("待处理问题")).toBeNull());
    expect(screen.queryByText("不应出现的晚到回答")).toBeNull();
  });

  it("keeps every decorative icon out of the accessibility tree", async () => {
    calculateChartMock.mockResolvedValueOnce(chart("庚"));
    const { container } = render(<Home />);

    await screen.findByText("已计算");
    const icons = Array.from(container.querySelectorAll("svg"));
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });
});
