import type {
  BirthInput,
  ChartFacts,
  ChatResponse,
  EvidenceScope,
  KnowledgeSchool,
  RetrievalMode,
} from "@/lib/types";

// Default to the same-origin Next.js proxy so local frontend ports do not require
// matching CORS changes in the API. A public base URL remains available for
// deployments that intentionally call the API directly from the browser.
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

type ApiErrorPayload = {
  detail?: unknown;
  message?: unknown;
};

export function isAbortError(reason: unknown): boolean {
  return Boolean(
    reason
    && typeof reason === "object"
    && "name" in reason
    && reason.name === "AbortError"
  );
}

function validationMessage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;

  const item = value as Record<string, unknown>;
  const message =
    typeof item.msg === "string"
      ? item.msg
      : typeof item.message === "string"
        ? item.message
        : null;
  if (!message) return null;

  const location = Array.isArray(item.loc)
    ? item.loc.filter((part) => part !== "body").map(String).join(".")
    : "";
  return location ? `${location}：${message}` : message;
}

export function apiErrorMessage(payload: unknown, status: number): string {
  const object = payload && typeof payload === "object" ? (payload as ApiErrorPayload) : null;
  const detail = object && "detail" in object ? object.detail : payload;

  if (Array.isArray(detail)) {
    const messages = detail.map(validationMessage).filter((item): item is string => Boolean(item));
    if (messages.length > 0) return messages.join("；");
  }

  const detailMessage = validationMessage(detail);
  if (detailMessage) return detailMessage;
  if (object && typeof object.message === "string") return object.message;
  return `请求失败 (${status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
  } catch (reason) {
    if (isAbortError(reason)) throw reason;
    throw new Error("无法连接本地后端服务，请确认 API 已启动");
  }
  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if ([500, 502, 503, 504].includes(response.status)) {
        throw new Error("无法连接本地后端服务，请确认 API 已启动");
      }
      payload = {};
    }
    throw new Error(apiErrorMessage(payload, response.status));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function calculateChart(birth: BirthInput, signal?: AbortSignal) {
  return request<ChartFacts>("/api/v1/chart", {
    method: "POST",
    body: JSON.stringify(birth),
    signal,
  });
}

export function askQuestion(input: {
  chart: ChartFacts;
  question: string;
  sessionId?: string;
  mode: RetrievalMode;
  evidenceScope: EvidenceScope;
  school: KnowledgeSchool;
}, signal?: AbortSignal) {
  return request<ChatResponse>("/api/v1/chat", {
    method: "POST",
    body: JSON.stringify({
      chart: input.chart,
      question: input.question,
      session_id: input.sessionId,
      school: input.school,
      mode: input.mode,
      evidence_scope: input.evidenceScope,
    }),
    signal,
  });
}

export function sendFeedback(sessionId: string, messageId: string, rating: -1 | 1, note = "") {
  return request<void>("/api/v1/feedback", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, message_id: messageId, rating, note }),
  });
}
