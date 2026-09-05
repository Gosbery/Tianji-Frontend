"use client";

import { Check, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChartPanel } from "@/components/ChartPanel";
import { ChatWorkspace } from "@/components/ChatWorkspace";
import { EvidencePanel } from "@/components/EvidencePanel";
import { TaskSidebar } from "@/components/TaskSidebar";
import {
  archiveTask,
  calculateChart,
  cancelTaskJob,
  createTask,
  getExperts,
  getTask,
  listTasks,
  renameTask,
  restoreTask,
  retryTaskJob,
  sendFeedback,
  sendTaskMessage,
} from "@/lib/api";
import { RETRIEVAL_MODE_OPTIONS } from "@/lib/options";
import type {
  BirthInput,
  ChartFacts,
  ChatResponse,
  ConversationMessage,
  EvidenceScope,
  ExpertProfile,
  Pillar,
  ResearchTask,
  ResearchTaskDetail,
  RetrievalMode,
  TaskEvent,
} from "@/lib/types";

const DEFAULT_BIRTH: BirthInput = {
  date: "2002-09-22",
  time: "16:00",
  gender: "male",
  timezone: "Asia/Shanghai",
  name: "访客",
};
const ACTIVE_TASK_KEY = "bazi-active-task-v2";

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function taskMessages(task: ResearchTaskDetail | null): ConversationMessage[] {
  if (!task?.active_job || !["queued", "running", "failed", "cancelled"].includes(task.active_job.status)) {
    return task?.messages ?? [];
  }
  const job = task.active_job;
  const pending: ConversationMessage[] = [
    {
      id: `${job.id}-user`,
      role: "user",
      content: job.question,
      turn_index: Number.MAX_SAFE_INTEGER - 1,
      created_at: job.created_at,
      response: null,
    },
    {
      id: `${job.id}-assistant`,
      role: "assistant",
      content: job.error || job.progress || "等待生成",
      turn_index: Number.MAX_SAFE_INTEGER,
      created_at: job.updated_at,
      response: null,
    },
  ];
  return [...task.messages, ...pending];
}

export default function Home() {
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [activeTask, setActiveTask] = useState<ResearchTaskDetail | null>(null);
  const [experts, setExperts] = useState<ExpertProfile[]>([]);
  const [defaultExpertId, setDefaultExpertId] = useState("liang-xiangrun");
  const [creating, setCreating] = useState(false);
  const [birth, setBirth] = useState(DEFAULT_BIRTH);
  const [draftChart, setDraftChart] = useState<ChartFacts | null>(null);
  const [draftStale, setDraftStale] = useState(false);
  const [selectedExpertId, setSelectedExpertId] = useState("liang-xiangrun");
  const [mode, setMode] = useState<RetrievalMode>("hybrid_rerank");
  const [evidenceScope, setEvidenceScope] = useState<EvidenceScope>("personal_preview");
  const [activePillar, setActivePillar] = useState<Pillar | null>(null);
  const [suggestedQuestion, setSuggestedQuestion] = useState("");
  const [latest, setLatest] = useState<ChatResponse | null>(null);
  const [focusedCitation, setFocusedCitation] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState("");
  const activeTaskIdRef = useRef<string | undefined>(undefined);

  const refreshTasks = useCallback(async () => {
    const result = await listTasks();
    setTasks(result.tasks);
    return result.tasks;
  }, []);

  const openTask = useCallback(async (taskId: string) => {
    activeTaskIdRef.current = taskId;
    setCreating(false);
    localStorage.setItem(ACTIVE_TASK_KEY, taskId);
    const detail = await getTask(taskId);
    if (activeTaskIdRef.current !== taskId) return;
    setActiveTask(detail);
    setActivePillar(detail.chart.pillars.find((item) => item.key === "day") ?? null);
    const response = [...detail.messages].reverse().find((message) => message.response)?.response;
    setLatest(response ?? null);
    setFocusedCitation(undefined);
    setSuggestedQuestion("");
  }, []);

  const refreshActive = useCallback(async (taskId?: string) => {
    const id = taskId ?? activeTaskIdRef.current;
    if (!id) return null;
    const detail = await getTask(id);
    if (activeTaskIdRef.current === id) {
      setActiveTask(detail);
      const response = [...detail.messages].reverse().find((message) => message.response)?.response;
      setLatest(response ?? null);
    }
    return detail;
  }, []);

  const calculateDraft = useCallback(async (input: BirthInput) => {
    setChartLoading(true);
    setError("");
    try {
      const chart = await calculateChart(input);
      setDraftChart(chart);
      setDraftStale(false);
      setActivePillar(chart.pillars.find((item) => item.key === "day") ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "排盘失败");
    } finally {
      setChartLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([getExperts("personal_preview"), listTasks()])
      .then(async ([expertResult, taskResult]) => {
        if (!active) return;
        setExperts(expertResult.experts);
        setDefaultExpertId(expertResult.default_expert_id);
        setSelectedExpertId(expertResult.default_expert_id);
        setTasks(taskResult.tasks);
        const stored = localStorage.getItem(ACTIVE_TASK_KEY);
        const candidate = taskResult.tasks.find((task) => !task.archived && task.id === stored)
          ?? taskResult.tasks.find((task) => !task.archived);
        if (candidate) await openTask(candidate.id);
        else {
          setCreating(true);
          await calculateDraft(DEFAULT_BIRTH);
        }
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "任务读取失败");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [calculateDraft, openTask]);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const source = new EventSource("/api/v1/tasks/events");
    const update = (raw: MessageEvent<string>) => {
      try {
        const event = JSON.parse(raw.data) as TaskEvent;
        void refreshTasks();
        if (event.task_id && event.task_id === activeTaskIdRef.current) {
          void refreshActive(event.task_id);
        }
      } catch {
        // The next event or focus refresh will repair an incomplete frame.
      }
    };
    for (const name of ["queued", "running", "progress", "succeeded", "failed", "cancelled"]) {
      source.addEventListener(name, update as EventListener);
    }
    source.onerror = () => { void refreshTasks(); void refreshActive(); };
    return () => source.close();
  }, [refreshActive, refreshTasks]);

  const visibleMessages = useMemo(() => taskMessages(activeTask), [activeTask]);
  const visibleExperts = experts.filter((expert) => (
    evidenceScope === "personal_preview" || expert.review_status === "reviewed"
  ));
  const activeBusy = activeTask?.active_job?.status === "queued"
    || activeTask?.active_job?.status === "running";

  function beginCreate() {
    activeTaskIdRef.current = undefined;
    setActiveTask(null);
    setCreating(true);
    setBirth(DEFAULT_BIRTH);
    setSelectedExpertId(defaultExpertId);
    setLatest(null);
    setError("");
    void calculateDraft(DEFAULT_BIRTH);
  }

  async function handleCreate() {
    setLoading(true);
    setError("");
    try {
      const created = await createTask({ birth, expertId: selectedExpertId, evidenceScope, mode });
      await refreshTasks();
      setActiveTask(created);
      activeTaskIdRef.current = created.id;
      localStorage.setItem(ACTIVE_TASK_KEY, created.id);
      setCreating(false);
      setActivePillar(created.chart.pillars.find((item) => item.key === "day") ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "任务创建失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleAsk(question: string): Promise<ChatResponse> {
    if (!activeTask) throw new Error("请先创建任务");
    const taskId = activeTask.id;
    const job = await sendTaskMessage(taskId, question);
    if (activeTaskIdRef.current === taskId) {
      setActiveTask((current) => current ? { ...current, active_job: job } : current);
    }
    void refreshTasks();
    while (true) {
      await sleep(350);
      const detail = await refreshActive(taskId);
      const currentJob = detail?.active_job;
      if (!currentJob || currentJob.id !== job.id) continue;
      if (currentJob.status === "failed") throw new Error(currentJob.error || "回答生成失败");
      if (currentJob.status === "cancelled") throw new Error("生成已取消");
      if (currentJob.status !== "succeeded") continue;
      await refreshTasks();
      const response = [...detail.messages].reverse().find(
        (message) => message.response?.message_id === currentJob.assistant_message_id,
      )?.response;
      if (!response) throw new Error("回答已完成，但结果读取失败");
      return response;
    }
  }

  async function updateTaskList(action: () => Promise<ResearchTask>) {
    try {
      await action();
      const refreshed = await refreshTasks();
      const activeId = activeTaskIdRef.current;
      if (activeId && !refreshed.some((task) => task.id === activeId && !task.archived)) {
        const next = refreshed.find((task) => !task.archived);
        if (next) await openTask(next.id);
        else beginCreate();
      } else if (activeId) {
        await refreshActive(activeId);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "任务操作失败");
    }
  }

  function selectPillar(pillar: Pillar) {
    setActivePillar(pillar);
    const subject = pillar.key === "day" ? "日主" : pillar.label;
    setSuggestedQuestion(`${subject}${pillar.stem}${pillar.branch}在基础结构中应该怎样理解？`);
  }

  return (
    <div className="app-shell task-app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Sparkles size={18} aria-hidden="true" /></span>
          <div><h1>命盘显微镜</h1><span>多专家命理任务</span></div>
        </div>
        <div className="mode-switch" role="group" aria-label="检索模式">
          {RETRIEVAL_MODE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              className={mode === option.value ? "active" : ""}
              disabled={!creating || loading}
              onClick={() => setMode(option.value)}
              aria-pressed={mode === option.value}
            >{option.label}</button>
          ))}
        </div>
        <label className={`preview-toggle ${evidenceScope === "personal_preview" ? "active" : ""}`}>
          <input
            type="checkbox"
            role="switch"
            aria-label="纳入机器校勘资料"
            checked={evidenceScope === "personal_preview"}
            disabled={!creating || loading}
            onChange={(event) => {
              const next = event.target.checked ? "personal_preview" : "reviewed_only";
              setEvidenceScope(next);
              if (next === "reviewed_only") {
                setSelectedExpertId(experts.find((expert) => expert.review_status === "reviewed")?.id ?? "");
              } else {
                setSelectedExpertId(defaultExpertId);
              }
            }}
          />
          <span className="toggle-track" aria-hidden="true"><i /></span>
          <ShieldCheck size={15} aria-hidden="true" />
          <span>个人预览资料</span>
        </label>
      </header>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="task-layout">
        <TaskSidebar
          tasks={tasks}
          activeTaskId={activeTask?.id}
          creating={creating}
          onCreate={beginCreate}
          onSelect={(id) => void openTask(id).catch((reason) => setError(String(reason)))}
          onRename={(id, title) => updateTaskList(() => renameTask(id, title))}
          onArchive={(id) => updateTaskList(() => archiveTask(id))}
          onRestore={(id) => updateTaskList(() => restoreTask(id))}
        />

        {creating ? (
          <div className="new-task-workspace">
            <ChartPanel
              birth={birth}
              chart={draftChart}
              activePillar={activePillar}
              loading={chartLoading}
              stale={draftStale}
              calculateLabel="预览命盘"
              onBirthChange={(next) => { setBirth(next); setDraftStale(true); }}
              onCalculate={() => void calculateDraft(birth)}
              onPillarClick={selectPillar}
            />
            <section className="expert-picker" aria-label="选择专家方法">
              <div className="panel-heading">
                <div><p className="eyebrow">METHOD</p><h2>选择分析方法</h2></div>
              </div>
              <div className="expert-options">
                {visibleExperts.map((expert) => (
                  <button
                    type="button"
                    key={expert.id}
                    className={selectedExpertId === expert.id ? "active" : ""}
                    onClick={() => setSelectedExpertId(expert.id)}
                  >
                    <span><strong>{expert.display_name}</strong>{selectedExpertId === expert.id && <Check size={15} />}</span>
                    <small>{expert.methodology.join(" · ")}</small>
                    {expert.review_status === "machine_verified" && <em>个人预览</em>}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="create-task-button"
                disabled={loading || draftStale || !draftChart || !selectedExpertId}
                onClick={() => void handleCreate()}
              >创建任务</button>
            </section>
          </div>
        ) : activeTask ? (
          <div className="workspace-grid task-workspace-grid">
            <ChartPanel
              birth={activeTask.birth}
              chart={activeTask.chart}
              activePillar={activePillar}
              loading={false}
              stale={false}
              readOnly
              onBirthChange={() => undefined}
              onCalculate={() => undefined}
              onPillarClick={selectPillar}
            />
            <ChatWorkspace
              key={activeTask.id}
              chart={activeTask.archived ? null : activeTask.chart}
              blockedReason={activeTask.archived ? "归档任务需恢复后才能继续提问" : undefined}
              mode={activeTask.mode === "lightrag" ? "hybrid_rerank" : activeTask.mode}
              evidenceScope={activeTask.evidence_scope}
              expertName={`${activeTask.expert_name} v${activeTask.expert_version}`}
              activeJob={activeTask.active_job}
              suggestedQuestion={suggestedQuestion}
              loading={Boolean(activeBusy)}
              initialMessages={visibleMessages}
              selectedMessageId={latest?.message_id}
              onAsk={handleAsk}
              onFeedback={(sessionId, messageId, rating, note) => sendFeedback(sessionId, messageId, rating, note)}
              onCancel={activeTask.active_job ? async () => {
                await cancelTaskJob(activeTask.id, activeTask.active_job!.id);
                await refreshActive(activeTask.id);
              } : undefined}
              onRetry={activeTask.active_job ? async () => {
                await retryTaskJob(activeTask.id, activeTask.active_job!.id);
                await refreshActive(activeTask.id);
              } : undefined}
              onResponseSelect={(response) => { setLatest(response); setFocusedCitation(undefined); }}
              onCitation={(response, citation) => {
                setLatest(response);
                setFocusedCitation(citation <= response.evidence.length ? citation : undefined);
              }}
            />
            <EvidencePanel
              evidence={latest?.evidence ?? []}
              uncertainties={latest?.uncertainties ?? activeTask.chart.uncertainties}
              latencyMs={latest?.latency_ms}
              focusedCitation={focusedCitation}
            />
          </div>
        ) : (
          <div className="task-loading" role="status">{loading ? "正在读取任务" : "请选择任务"}</div>
        )}
      </div>
    </div>
  );
}
