"use client";

import { ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChartPanel } from "@/components/ChartPanel";
import { ChatWorkspace } from "@/components/ChatWorkspace";
import { EvidencePanel } from "@/components/EvidencePanel";
import { askQuestion, calculateChart, isAbortError, sendFeedback } from "@/lib/api";
import { RETRIEVAL_MODE_OPTIONS } from "@/lib/options";
import type {
  BirthInput,
  ChartFacts,
  ChatResponse,
  EvidenceScope,
  KnowledgeSchool,
  Pillar,
  RetrievalMode,
} from "@/lib/types";

const DEFAULT_BIRTH: BirthInput = {
  date: "1990-01-01",
  time: "12:00",
  timezone: "Asia/Shanghai",
  name: "访客",
};

function supersededRequestError(): Error {
  const error = new Error("请求已取消");
  error.name = "AbortError";
  return error;
}

export default function Home() {
  const [birth, setBirth] = useState(DEFAULT_BIRTH);
  const [chart, setChart] = useState<ChartFacts | null>(null);
  const [activePillar, setActivePillar] = useState<Pillar | null>(null);
  const [mode, setMode] = useState<RetrievalMode>("hybrid_rerank");
  const [school, setSchool] = useState<KnowledgeSchool>("基础共识");
  const [evidenceScope, setEvidenceScope] = useState<EvidenceScope>("reviewed_only");
  const [suggestedQuestion, setSuggestedQuestion] = useState("");
  const [latest, setLatest] = useState<ChatResponse | null>(null);
  const [sessionId, setSessionId] = useState<string>();
  const [chatRevision, setChatRevision] = useState(0);
  const [chartLoading, setChartLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [chartStale, setChartStale] = useState(false);
  const [error, setError] = useState("");
  const chartAbortRef = useRef<AbortController | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const hasChartRef = useRef(false);

  const runChartRequest = useCallback(async (input: BirthInput) => {
    chartAbortRef.current?.abort();
    const controller = new AbortController();
    chartAbortRef.current = controller;
    setChartLoading(true);
    setError("");
    try {
      const result = await calculateChart(input, controller.signal);
      if (chartAbortRef.current !== controller) throw supersededRequestError();

      chatAbortRef.current?.abort();
      chatAbortRef.current = null;
      setChatLoading(false);
      hasChartRef.current = true;
      setChart(result);
      setActivePillar(result.pillars.find((pillar) => pillar.key === "day") ?? result.pillars[0] ?? null);
      setChartStale(false);
      setSessionId(undefined);
      setLatest(null);
      setSuggestedQuestion("");
      setChatRevision((current) => current + 1);
    } catch (reason) {
      if (isAbortError(reason) || chartAbortRef.current !== controller) return;
      setChartStale(hasChartRef.current);
      setError(reason instanceof Error ? reason.message : "排盘失败");
    } finally {
      if (chartAbortRef.current === controller) {
        chartAbortRef.current = null;
        setChartLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void runChartRequest(DEFAULT_BIRTH);
    });
    return () => {
      active = false;
      const chartRequest = chartAbortRef.current;
      const chatRequest = chatAbortRef.current;
      chartAbortRef.current = null;
      chatAbortRef.current = null;
      chartRequest?.abort();
      chatRequest?.abort();
    };
  }, [runChartRequest]);

  function updateBirth(nextBirth: BirthInput) {
    setBirth(nextBirth);
    setError("");
    const chartRequest = chartAbortRef.current;
    if (chartRequest) {
      chartAbortRef.current = null;
      chartRequest.abort();
      setChartLoading(false);
    }
    if (hasChartRef.current) {
      chatAbortRef.current?.abort();
      chatAbortRef.current = null;
      setChatLoading(false);
      setChartStale(true);
      setLatest(null);
      setSuggestedQuestion("");
    }
  }

  function selectPillar(pillar: Pillar) {
    setActivePillar(pillar);
    const subject = pillar.key === "day" ? "日主" : pillar.label;
    setSuggestedQuestion(`${subject}${pillar.stem}${pillar.branch}在基础结构中应该怎样理解？`);
  }

  function changeMode(nextMode: RetrievalMode) {
    setMode(nextMode);
    setLatest(null);
  }

  function changeSchool(nextSchool: KnowledgeSchool) {
    setSchool(nextSchool);
    setLatest(null);
  }

  async function handleAsk(question: string) {
    if (!chart) throw new Error("请先完成排盘");
    chatAbortRef.current?.abort();
    const controller = new AbortController();
    chatAbortRef.current = controller;
    setChatLoading(true);
    setError("");
    try {
      const response = await askQuestion({
        chart,
        question,
        sessionId,
        mode,
        evidenceScope,
        school,
      }, controller.signal);
      if (chatAbortRef.current !== controller) throw supersededRequestError();
      setLatest(response);
      setSessionId(response.session_id);
      return response;
    } finally {
      if (chatAbortRef.current === controller) {
        chatAbortRef.current = null;
        setChatLoading(false);
      }
    }
  }

  async function handleFeedback(
    messageSessionId: string,
    messageId: string,
    rating: -1 | 1,
    note: string,
  ) {
    await sendFeedback(messageSessionId, messageId, rating, note);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Sparkles size={18} aria-hidden="true" /></span>
          <div><h1>命盘显微镜</h1><span>墨韵玄机 · Bazi Lab</span></div>
        </div>
        <div className="mode-switch" role="group" aria-label="检索模式">
          {RETRIEVAL_MODE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              className={mode === option.value ? "active" : ""}
              disabled={chatLoading}
              onClick={() => changeMode(option.value)}
              aria-pressed={mode === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className={`preview-toggle ${evidenceScope === "personal_preview" ? "active" : ""}`}>
          <input
            type="checkbox"
            role="switch"
            aria-label="纳入机器校勘资料"
            checked={evidenceScope === "personal_preview"}
            disabled={chatLoading}
            onChange={(event) => {
              setEvidenceScope(event.target.checked ? "personal_preview" : "reviewed_only");
              setLatest(null);
            }}
          />
          <span className="toggle-track" aria-hidden="true"><i /></span>
          <ShieldCheck size={15} aria-hidden="true" />
          <span>纳入机器校勘资料</span>
        </label>
      </header>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="workspace-grid">
        <ChartPanel
          birth={birth}
          chart={chart}
          activePillar={activePillar}
          loading={chartLoading}
          stale={chartStale}
          onBirthChange={updateBirth}
          onCalculate={() => void runChartRequest(birth)}
          onPillarClick={selectPillar}
        />
        <ChatWorkspace
          key={chatRevision}
          chart={chartStale ? null : chart}
          blockedReason={chartStale ? "出生信息已修改，请先重新排盘" : undefined}
          mode={mode}
          school={school}
          evidenceScope={evidenceScope}
          suggestedQuestion={suggestedQuestion}
          loading={chatLoading}
          onAsk={handleAsk}
          onFeedback={handleFeedback}
          onSchoolChange={changeSchool}
        />
        <EvidencePanel
          evidence={latest?.evidence ?? []}
          uncertainties={latest?.uncertainties ?? chart?.uncertainties ?? []}
          latencyMs={latest?.latency_ms}
        />
      </div>
    </div>
  );
}
