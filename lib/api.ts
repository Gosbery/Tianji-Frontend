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
  onChunk?: (content: string) => void;
  onProgress?: (message: string) => void;
}, signal?: AbortSignal): Promise<ChatResponse> {
  return streamRequest("/api/v1/chat/stream", {
    chart: input.chart,
    question: input.question,
    session_id: input.sessionId,
    school: input.school,
    mode: input.mode,
    evidence_scope: input.evidenceScope,
  }, signal, input.onChunk, input.onProgress);
}

async function streamRequest(
  path: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
  onChunk?: (content: string) => void,
  onProgress?: (message: string) => void,
): Promise<ChatResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(payload),
      signal,
      cache: "no-store",
    });
  } catch (reason) {
    if (isAbortError(reason)) throw reason;
    throw new Error("无法连接本地后端服务，请确认 API 已启动");
  }

  if (!response.ok) {
    let errorPayload: unknown = {};
    try {
      errorPayload = await response.json();
    } catch {
      if ([500, 502, 503, 504].includes(response.status)) {
        throw new Error("无法连接本地后端服务，请确认 API 已启动");
      }
    }
    throw new Error(apiErrorMessage(errorPayload, response.status));
  }

  if (!response.body) throw new Error("流式响应不可用，请稍后重试");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed: ChatResponse | null = null;

  const consumeFrame = (frame: string) => {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    const event = JSON.parse(data) as {
      type?: string;
      content?: unknown;
      message?: unknown;
      response?: ChatResponse;
    };
    if (event.type === "chunk" && typeof event.content === "string") {
      onChunk?.(event.content);
    } else if (event.type === "progress" && typeof event.message === "string") {
      onProgress?.(event.message);
    } else if (event.type === "done" && event.response) {
      completed = event.response;
    } else if (event.type === "error") {
      throw new Error(typeof event.message === "string" ? event.message : "回答生成失败，请稍后重试。");
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) consumeFrame(frame);
    if (done) break;
  }
  if (buffer.trim()) consumeFrame(buffer);
  if (!completed) throw new Error("流式响应未完成，请稍后重试");
  return completed;
}

export function sendFeedback(sessionId: string, messageId: string, rating: -1 | 1, note = "") {
  return request<void>("/api/v1/feedback", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, message_id: messageId, rating, note }),
  });
}
