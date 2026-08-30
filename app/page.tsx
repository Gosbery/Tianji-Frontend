"use client";

import { Activity, FlaskConical } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ChartPanel } from "@/components/ChartPanel";
import { ChatWorkspace } from "@/components/ChatWorkspace";
import { EvidencePanel } from "@/components/EvidencePanel";
import { askQuestion, calculateChart, sendFeedback } from "@/lib/api";
import type { BirthInput, ChartFacts, ChatResponse, Pillar, RetrievalMode } from "@/lib/types";

const DEFAULT_BIRTH: BirthInput = {
  date: "1990-01-01",
  time: "12:00",
  timezone: "Asia/Shanghai",
  name: "访客",
};

const MODE_OPTIONS: { value: RetrievalMode; label: string }[] = [
  { value: "dense", label: "Dense" },
  { value: "hybrid", label: "Hybrid" },
  { value: "hybrid_rerank", label: "Rerank" },
];

export default function Home() {
  const [birth, setBirth] = useState(DEFAULT_BIRTH);
  const [chart, setChart] = useState<ChartFacts | null>(null);
  const [activePillar, setActivePillar] = useState<Pillar | null>(null);
  const [mode, setMode] = useState<RetrievalMode>("hybrid");
  const [suggestedQuestion, setSuggestedQuestion] = useState("");
  const [latest, setLatest] = useState<ChatResponse | null>(null);
  const [sessionId, setSessionId] = useState<string>();
  const [chartLoading, setChartLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshChart = useCallback(async () => {
    setChartLoading(true);
    setError("");
    try {
      const result = await calculateChart(birth);
      setChart(result);
      setActivePillar(result.pillars[2]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "排盘失败");
    } finally {
      setChartLoading(false);
    }
  }, [birth]);

  useEffect(() => {
    void refreshChart();
    // The default chart should be available as soon as the workspace opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectPillar(pillar: Pillar) {
    setActivePillar(pillar);
    const subject = pillar.key === "day" ? "日主" : pillar.label;
    setSuggestedQuestion(`${subject}${pillar.stem}${pillar.branch}在基础结构中应该怎样理解？`);
  }

  async function handleAsk(question: string) {
    if (!chart) throw new Error("请先完成排盘");
    setChatLoading(true);
    setError("");
    try {
      const response = await askQuestion({ chart, question, sessionId, mode });
      setLatest(response);
      setSessionId(response.session_id);
      return response;
    } finally {
      setChatLoading(false);
    }
  }

  async function handleFeedback(rating: -1 | 1) {
    if (sessionId) await sendFeedback(sessionId, rating);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><FlaskConical size={19} /></span>
          <div><strong>命盘显微镜</strong><span>Bazi RAG Lab</span></div>
        </div>
        <div className="mode-switch" aria-label="检索模式">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={mode === option.value ? "active" : ""}
              onClick={() => setMode(option.value)}
              aria-pressed={mode === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="system-state"><Activity size={15} /><span>基础知识库</span></div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="workspace-grid">
        <ChartPanel
          birth={birth}
          chart={chart}
          activePillar={activePillar}
          loading={chartLoading}
          onBirthChange={setBirth}
          onCalculate={refreshChart}
          onPillarClick={selectPillar}
        />
        <ChatWorkspace
          chart={chart}
          mode={mode}
          suggestedQuestion={suggestedQuestion}
          loading={chatLoading}
          onAsk={handleAsk}
          onFeedback={handleFeedback}
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

