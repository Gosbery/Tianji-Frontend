"use client";

import {
  ArrowUp,
  Bot,
  CircleAlert,
  CircleUserRound,
  CornerDownRight,
  MessageCircleQuestion,
  MessageSquareText,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { parseAnswer, type InlinePart } from "@/lib/answer-format";
import { isAbortError } from "@/lib/api";
import { retrievalModeDescription, SCHOOL_OPTIONS } from "@/lib/options";
import type {
  ChartFacts,
  ChatResponse,
  EvidenceScope,
  KnowledgeSchool,
  RetrievalMode,
} from "@/lib/types";

type Message = {
  id: string;
  role: "assistant" | "user";
  content: string;
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
  school: KnowledgeSchool;
  evidenceScope: EvidenceScope;
  suggestedQuestion: string;
  loading: boolean;
  onAsk: (question: string) => Promise<ChatResponse>;
  onFeedback: (
    sessionId: string,
    messageId: string,
    rating: -1 | 1,
    note: string,
  ) => Promise<void>;
  onSchoolChange: (school: KnowledgeSchool) => void;
};

const INITIAL_MESSAGE = "命盘事实已就绪后，可以从日主、某一柱、十神或五行开始讨论。";

function InlineText({ parts }: { parts: InlinePart[] }) {
  return parts.map((part, index) =>
    part.bold
      ? <strong key={`${part.text}-${index}`}>{part.text}</strong>
      : <span key={`${part.text}-${index}`}>{part.text}</span>
  );
}

export function FormattedAnswer({ text }: { text: string }) {
  const blocks = parseAnswer(text);
  return (
    <div className="answer-text">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "heading") {
          return <h3 key={key}><InlineText parts={block.content} /></h3>;
        }
        if (block.type === "list") {
          const items = block.items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`}><InlineText parts={item} /></li>
          ));
          return block.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
        }
        return <p key={key}><InlineText parts={block.content} /></p>;
      })}
    </div>
  );
}

export function ChatWorkspace({
  chart,
  blockedReason,
  mode,
  school,
  evidenceScope,
  suggestedQuestion,
  loading,
  onAsk,
  onFeedback,
  onSchoolChange,
}: Props) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: "assistant-initial", role: "assistant", content: INITIAL_MESSAGE },
  ]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageSequence = useRef(0);
  const feedbackInFlight = useRef(new Set<string>());
  const messageCount = messages.length;

  useEffect(() => {
    const scrollArea = chatScrollRef.current;
    if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
  }, [messageCount, loading]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [question]);

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
    try {
      const response = await onAsk(value);
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId("assistant"),
          role: "assistant",
          content: response.answer,
          response,
        },
      ]);
    } catch (reason) {
      if (isAbortError(reason)) {
        setMessages((current) => current.filter((message) => message.id !== userMessageId));
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
          <article key={message.id} className={`message ${message.role}`}>
            <div className="message-avatar" aria-hidden="true">
              {message.role === "assistant" ? <Bot size={17} /> : <CircleUserRound size={17} />}
            </div>
            <div className="message-content">
              <span className="message-author">{message.role === "assistant" ? "研究助手" : "你"}</span>
              <FormattedAnswer text={message.content} />
              {message.response && (
                <>
                  <div className="message-actions">
                    <span>{message.response.evidence.length} 条依据</span>
                    {message.response.token_usage !== null && (
                      <span>{message.response.token_usage} tokens</span>
                    )}
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
        {loading && (
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
          placeholder={blockedReason ?? (chart ? "围绕命盘提出一个问题" : "请先完成排盘")}
          aria-describedby={blockedReason ? "chat-blocked-reason" : undefined}
          disabled={!chart || loading}
          rows={2}
        />
        <div className="composer-footer">
          <div className="retrieval-settings">
            <select
              aria-label="知识流派"
              value={school}
              disabled={loading}
              onChange={(event) => onSchoolChange(event.target.value as KnowledgeSchool)}
            >
              {SCHOOL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <span>
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
