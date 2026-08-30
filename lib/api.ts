import type { BirthInput, ChartFacts, ChatResponse, RetrievalMode } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail ?? `请求失败 (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function calculateChart(birth: BirthInput) {
  return request<ChartFacts>("/api/v1/chart", {
    method: "POST",
    body: JSON.stringify(birth),
  });
}

export function askQuestion(input: {
  chart: ChartFacts;
  question: string;
  sessionId?: string;
  mode: RetrievalMode;
}) {
  return request<ChatResponse>("/api/v1/chat", {
    method: "POST",
    body: JSON.stringify({
      chart: input.chart,
      question: input.question,
      session_id: input.sessionId,
      school: "基础共识",
      mode: input.mode,
    }),
  });
}

export function sendFeedback(sessionId: string, rating: -1 | 1) {
  return request<void>("/api/v1/feedback", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, rating, note: "" }),
  });
}
