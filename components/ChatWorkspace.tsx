"use client";

import {
  ArrowUp,
  BookOpen,
  Bot,
  CircleAlert,
  CircleUserRound,
  CornerDownRight,
  MessageCircleQuestion,
  MessageSquareText,
  PanelsTopLeft,
  RotateCcw,
  Square,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { parseAnswer, type InlinePart } from "@/lib/answer-format";
import { isAbortError } from "@/lib/api";
import { FORTUNE_TOPICS, retrievalModeDescription } from "@/lib/options";
import type {
  ChartFacts,
  ChatResponse,
  ConversationMessage,
  EvidenceScope,
  GenerationJob,
  RetrievalMode,
} from "@/lib/types";

type Message = {
  id: string;
  role: "assistant" | "user";
  content: string;
  progress?: string[];
  streaming?: boolean;
  response?: ChatResponse;
  feedbackRating?: -1 | 1;
  feedbackPending?: boolean;
  feedbackNote?: string;
  feedbackNoteOpen?: boolean;
  feedbackError?: string;
};

type Props = {
  chart: ChartFacts | null;
  blockedReason?: string;
  mode: RetrievalMode;
  evidenceScope: EvidenceScope;
  suggestedQuestion: string;
  loading: boolean;
  expertName?: string;
  activeJob?: GenerationJob | null;
  initialMessages?: ConversationMessage[];
  selectedMessageId?: string;
  onAsk: (
    question: string,
    onChunk?: (content: string) => void,
    onProgress?: (message: string) => void,
  ) => Promise<ChatResponse>;
  onFeedback: (
    sessionId: string,
    messageId: string,
    rating: -1 | 1,
    note: string,
  ) => Promise<void>;
  onCancel?: () => Promise<void>;
  onRetry?: () => Promise<void>;
  onResponseSelect: (response: ChatResponse) => void;
  onCitation: (response: ChatResponse, citation: number) => void;
};

const INITIAL_MESSAGE = "命盘事实就绪后，可以直接询问财富、婚姻、健康、事业或其他预测问题。";

function InlineText({
  parts,
  onCitation,
}: {
  parts: InlinePart[];
  onCitation?: (citation: number) => void;
}) {
  return parts.flatMap((part, partIndex) =>
    part.text.split(/(\[\d+\])/g).filter(Boolean).map((text, textIndex) => {
      const citation = text.match(/^\[(\d+)\]$/);
      if (citation && onCitation) {
        const number = Number(citation[1]);
        return (
          <button
            type="button"
            className="inline-citation"
            title={`查看依据 ${number}`}
            aria-label={`查看依据 ${number}`}
            key={`${partIndex}-${textIndex}-${text}`}
            onClick={(event) => {
              event.stopPropagation();
              onCitation(number);
            }}
          >
            {text}
          </button>
        );
      }
      const key = `${partIndex}-${textIndex}-${text}`;
      return part.bold ? <strong key={key}>{text}</strong> : <span key={key}>{text}</span>;
    })
  );
}

export function FormattedAnswer({
  text,
  streaming = false,
  onCitation,
}: {
  text: string;
  streaming?: boolean;
  onCitation?: (citation: number) => void;
}) {
  const blocks = parseAnswer(text);
  return (
    <div className="answer-text">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        const cursor = streaming && index === blocks.length - 1
          ? <span className="stream-cursor" aria-hidden="true" />
          : null;
        if (block.type === "heading") {
          return <h3 key={key}><InlineText parts={block.content} onCitation={onCitation} />{cursor}</h3>;
        }
        if (block.type === "list") {
          const items = block.items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`}>
              <InlineText parts={item} onCitation={onCitation} />
              {itemIndex === block.items.length - 1 ? cursor : null}
            </li>
          ));
          return block.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
        }
        return <p key={key}><InlineText parts={block.content} onCitation={onCitation} />{cursor}</p>;
      })}
    </div>
  );
}

export function ChatWorkspace({
  chart,
  blockedReason,
  mode,
  evidenceScope,
  suggestedQuestion,
  loading,
  expertName,
  activeJob,
  initialMessages,
  selectedMessageId,
  onAsk,
  onFeedback,
  onCancel,
  onRetry,
  onResponseSelect,
  onCitation,
}: Props) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => restoredMessages(initialMessages ?? []));
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageSequence = useRef(0);
  const feedbackInFlight = useRef(new Set<string>());
  const messageCount = messages.length;
  const latestContentLength = messages.at(-1)?.content.length ?? 0;

  useEffect(() => {
    const scrollArea = chatScrollRef.current;
    if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
  }, [messageCount, latestContentLength, loading]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [question]);

  useEffect(() => {
    if (initialMessages) setMessages(restoredMessages(initialMessages));
  }, [initialMessages]);

  function nextMessageId(role: Message["role"]): string {
    messageSequence.current += 1;
    return `${role}-${messageSequence.current}`;
  }

  function updateMessage(messageId: string, update: Partial<Message>) {
    setMessages((current) =>
      current.map((message) => message.id === messageId ? { ...message, ...update } : message)
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = question.trim();
    if (!value || !chart || loading) return;
    const userMessageId = nextMessageId("user");
    setQuestion("");
    setMessages((current) => [
      ...current,
      { id: userMessageId, role: "user", content: value },
    ]);
    let streamingAssistantId: string | null = null;
    const onProgress = (progress: string) => {
      if (!progress) return;
      if (!streamingAssistantId) {
        streamingAssistantId = nextMessageId("assistant");
        setMessages((current) => [
          ...current,
          {
            id: streamingAssistantId!,
            role: "assistant",
            content: "",
            progress: [progress],
            streaming: true,
          },
        ]);
        return;
      }
      setMessages((current) => current.map((message) => {
        if (message.id !== streamingAssistantId) return message;
        if (message.progress?.at(-1) === progress) return message;
        return { ...message, progress: [...(message.progress ?? []), progress] };
      }));
    };
    const onChunk = (chunk: string) => {
      if (!chunk) return;
      if (!streamingAssistantId) {
        streamingAssistantId = nextMessageId("assistant");
        setMessages((current) => [
          ...current,
          { id: streamingAssistantId!, role: "assistant", content: chunk, streaming: true },
        ]);
        return;
      }
      setMessages((current) => current.map((message) => message.id === streamingAssistantId
        ? { ...message, content: message.content + chunk }
        : message));
    };
    try {
      const response = await onAsk(value, onChunk, onProgress);
      setMessages((current) => {
        if (streamingAssistantId) {
          return current.map((message) => message.id === streamingAssistantId
            ? { ...message, content: response.answer, response, streaming: false }
            : message);
        }
        return [
          ...current,
          {
            id: nextMessageId("assistant"),
            role: "assistant",
            content: response.answer,
            response,
          },
        ];
      });
    } catch (reason) {
      if (isAbortError(reason)) {
        setMessages((current) => current.filter((message) =>
          message.id !== userMessageId && message.id !== streamingAssistantId
        ));
        return;
      }
      if (streamingAssistantId) {
        setMessages((current) => current.map((message) => message.id === streamingAssistantId
          ? {
              ...message,
              content: message.content || (reason instanceof Error ? reason.message : "请求失败"),
              streaming: false,
            }
          : message));
        return;
      }
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId("assistant"),
          role: "assistant",
          content: reason instanceof Error ? reason.message : "请求失败",
        },
      ]);
    }
  }

  async function submitFeedback(message: Message, rating: -1 | 1) {
    if (!message.response || message.feedbackRating || feedbackInFlight.current.has(message.id)) {
      return;
    }

    feedbackInFlight.current.add(message.id);
    updateMessage(message.id, { feedbackPending: true, feedbackError: undefined });
    try {
      await onFeedback(
        message.response.session_id,
        message.response.message_id,
        rating,
        message.feedbackNote?.trim() ?? "",
      );
      updateMessage(message.id, {
        feedbackPending: false,
        feedbackRating: rating,
        feedbackNoteOpen: false,
      });
    } catch (reason) {
      updateMessage(message.id, {
        feedbackPending: false,
        feedbackError: reason instanceof Error ? reason.message : "反馈提交失败",
      });
    } finally {
      feedbackInFlight.current.delete(message.id);
    }
  }

  return (
    <main className="chat-workspace">
      <div
        ref={chatScrollRef}
        className="chat-scroll"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={loading}
      >
        {messages.map((message) => (
          <article
            key={message.id}
            className={`message ${message.role} ${selectedMessageId === message.response?.message_id ? "selected-response" : ""}`}
            onClick={() => message.response && onResponseSelect(message.response)}
          >
            <div className="message-avatar" aria-hidden="true">
              {message.role === "assistant" ? <Bot size={17} /> : <CircleUserRound size={17} />}
            </div>
            <div className="message-content">
              <span className="message-author">{message.role === "assistant" ? "研究助手" : "你"}</span>
              {message.progress && message.progress.length > 0 && (
                <div
                  className={`reasoning-progress ${message.streaming ? "streaming" : "complete"}`}
                  aria-label="分析进度"
                >
                  {message.progress.map((progress, index) => (
                    <span
                      key={`${message.id}-progress-${index}`}
                      className={message.streaming && index === message.progress!.length - 1
                        ? "active"
                        : ""}
                    >
                      {progress}
                    </span>
                  ))}
                </div>
              )}
              {message.streaming && !message.content && (
                <div className="thought-wave" aria-hidden="true">
                  <i /><i /><i /><i /><i />
                </div>
              )}
              {message.content && (
                <FormattedAnswer
                  text={message.content}
                  streaming={message.streaming}
                  onCitation={message.response
                    ? (citation) => onCitation(message.response!, citation)
                    : undefined}
                />
              )}
              {message.response && (
                <>
                  <div className="message-actions">
                    <span>{message.response.evidence.length} 条依据</span>
                    {message.response.citations_validated && <span>引用已核验</span>}
                    {message.response.token_usage !== null && (
                      <span>{message.response.token_usage} tokens</span>
                    )}
                    <button
                      type="button"
                      title="查看此回答的证据"
                      aria-label="查看此回答的证据"
                      aria-pressed={selectedMessageId === message.response.message_id}
                      onClick={(event) => {
                        event.stopPropagation();
                        onResponseSelect(message.response!);
                      }}
                    >
                      <BookOpen size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      title="添加反馈说明"
                      aria-label="添加反馈说明"
                      aria-expanded={Boolean(message.feedbackNoteOpen)}
                      disabled={Boolean(message.feedbackRating || message.feedbackPending)}
                      onClick={() => updateMessage(message.id, {
                        feedbackNoteOpen: !message.feedbackNoteOpen,
                      })}
                    >
                      <MessageSquareText size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      title="有帮助"
                      aria-label="有帮助"
                      aria-pressed={message.feedbackRating === 1}
                      className={message.feedbackRating === 1 ? "selected" : ""}
                      disabled={Boolean(message.feedbackRating || message.feedbackPending)}
                      onClick={() => void submitFeedback(message, 1)}
                    >
                      <ThumbsUp size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      title="没有帮助"
                      aria-label="没有帮助"
                      aria-pressed={message.feedbackRating === -1}
                      className={message.feedbackRating === -1 ? "selected" : ""}
                      disabled={Boolean(message.feedbackRating || message.feedbackPending)}
                      onClick={() => void submitFeedback(message, -1)}
                    >
                      <ThumbsDown size={14} aria-hidden="true" />
                    </button>
                  </div>
                  {message.feedbackNoteOpen && !message.feedbackRating && (
                    <label className="feedback-note">
                      <span className="sr-only">反馈说明（可选）</span>
                      <input
                        value={message.feedbackNote ?? ""}
                        maxLength={1000}
                        placeholder="反馈说明（可选）"
                        onChange={(event) => updateMessage(message.id, {
                          feedbackNote: event.target.value,
                        })}
                      />
                    </label>
                  )}
                  {message.feedbackError && (
                    <span className="feedback-error" role="alert">{message.feedbackError}</span>
                  )}
                  {message.response.followups.length > 0 && (
                    <div className="followup-list" aria-label="追问建议">
                      {message.response.followups.map((followup, index) => (
                        <button
                          type="button"
                          key={`${message.id}-followup-${index}`}
                          disabled={!chart || loading}
                          onClick={() => setQuestion(followup)}
                        >
                          <CornerDownRight size={13} aria-hidden="true" />
                          <span>{followup}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </article>
        ))}
        {loading && !messages.some((message) => message.streaming) && (
          <article className="message assistant" role="status" aria-label="研究助手正在生成回答">
            <div className="message-avatar" aria-hidden="true"><Bot size={17} /></div>
            <div className="thinking" aria-hidden="true"><i /><i /><i /></div>
          </article>
        )}
      </div>

      <form className="composer" onSubmit={submit}>
        {blockedReason && (
          <div id="chat-blocked-reason" className="chat-state-notice" role="status">
            <CircleAlert size={14} aria-hidden="true" />
            <span>{blockedReason}</span>
          </div>
        )}
        {activeJob && ["queued", "running", "failed", "cancelled"].includes(activeJob.status) && (
          <div className={`job-state ${activeJob.status}`} role="status">
            <span>{activeJob.error || activeJob.progress || "等待生成"}</span>
            {(activeJob.status === "queued" || activeJob.status === "running") && onCancel && (
              <button type="button" onClick={() => void onCancel()}>
                <Square size={12} aria-hidden="true" />取消
              </button>
            )}
            {(activeJob.status === "failed" || activeJob.status === "cancelled") && onRetry && (
              <button type="button" onClick={() => void onRetry()}>
                <RotateCcw size={12} aria-hidden="true" />重试
              </button>
            )}
          </div>
        )}
        {suggestedQuestion && (
          <button
            type="button"
            className="question-suggestion"
            onClick={() => setQuestion(suggestedQuestion)}
          >
            <MessageCircleQuestion size={14} aria-hidden="true" />
            <span>{suggestedQuestion}</span>
          </button>
        )}
        <div className="fortune-topics" aria-label="命理主题">
          <span className="fortune-topics-label">
            <PanelsTopLeft size={14} aria-hidden="true" />
            命理主题
          </span>
          <div className="fortune-topic-list">
            {FORTUNE_TOPICS.map((topic) => (
              <button
                type="button"
                key={topic.id}
                disabled={!chart || loading}
                title={topic.question}
                onClick={() => {
                  setQuestion(topic.question);
                  textareaRef.current?.focus();
                }}
              >
                {topic.label}
              </button>
            ))}
          </div>
        </div>
        <label className="sr-only" htmlFor="chat-question">问题</label>
        <textarea
          ref={textareaRef}
          id="chat-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={blockedReason ?? (chart ? "输入你想预测的问题" : "请先完成排盘")}
          aria-describedby={blockedReason ? "chat-blocked-reason" : undefined}
          disabled={!chart || loading}
          rows={2}
        />
        <div className="composer-footer">
          <div className="retrieval-settings">
            <span>
              {expertName ? `${expertName} · ` : ""}
              {retrievalModeDescription(mode)}
              {evidenceScope === "personal_preview" ? " · 含机器校勘" : " · 仅人工审核"}
            </span>
          </div>
          <button
            type="submit"
            className="send-button"
            disabled={!chart || !question.trim() || loading}
            title="发送"
            aria-label="发送问题"
          >
            <ArrowUp size={18} aria-hidden="true" />
          </button>
        </div>
      </form>
    </main>
  );
}

function restoredMessages(messages: ConversationMessage[]): Message[] {
  if (messages.length === 0) {
    return [{ id: "assistant-initial", role: "assistant", content: INITIAL_MESSAGE }];
  }
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    response: message.response ?? undefined,
  }));
}
