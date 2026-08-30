"use client";

import { ArrowUp, Bot, CircleUserRound, ThumbsDown, ThumbsUp } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { ChartFacts, ChatResponse, RetrievalMode } from "@/lib/types";

type Message = {
  role: "assistant" | "user";
  content: string;
  response?: ChatResponse;
};

type Props = {
  chart: ChartFacts | null;
  mode: RetrievalMode;
  suggestedQuestion: string;
  loading: boolean;
  onAsk: (question: string) => Promise<ChatResponse>;
  onFeedback: (rating: -1 | 1) => Promise<void>;
};

const INITIAL_MESSAGE = "命盘事实已就绪后，可以从日主、某一柱、十神或五行开始讨论。";

function FormattedAnswer({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className="answer-text">
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={index}>{part.slice(2, -2)}</strong>
          : <span key={index}>{part}</span>
      )}
    </p>
  );
}

export function ChatWorkspace({ chart, mode, suggestedQuestion, loading, onAsk, onFeedback }: Props) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: INITIAL_MESSAGE },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (suggestedQuestion) setQuestion(suggestedQuestion);
  }, [suggestedQuestion]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = question.trim();
    if (!value || !chart || loading) return;
    setQuestion("");
    setMessages((current) => [...current, { role: "user", content: value }]);
    try {
      const response = await onAsk(value);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: response.answer, response },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: error instanceof Error ? error.message : "请求失败" },
      ]);
    }
  }

  return (
    <main className="chat-workspace">
      <div className="chat-scroll">
        {messages.map((message, index) => (
          <article key={index} className={`message ${message.role}`}>
            <div className="message-avatar">
              {message.role === "assistant" ? <Bot size={17} /> : <CircleUserRound size={17} />}
            </div>
            <div className="message-content">
              <span className="message-author">{message.role === "assistant" ? "研究助手" : "你"}</span>
              <FormattedAnswer text={message.content} />
              {message.response && (
                <div className="message-actions">
                  <span>{message.response.evidence.length} 条依据</span>
                  <button title="有帮助" onClick={() => onFeedback(1)}><ThumbsUp size={14} /></button>
                  <button title="没有帮助" onClick={() => onFeedback(-1)}><ThumbsDown size={14} /></button>
                </div>
              )}
            </div>
          </article>
        ))}
        {loading && (
          <article className="message assistant">
            <div className="message-avatar"><Bot size={17} /></div>
            <div className="thinking"><i /><i /><i /></div>
          </article>
        )}
        <div ref={bottomRef} />
      </div>

      <form className="composer" onSubmit={submit}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={chart ? "围绕命盘提出一个问题" : "请先完成排盘"}
          disabled={!chart || loading}
          rows={2}
        />
        <div className="composer-footer">
          <span>{mode === "dense" ? "向量召回" : mode === "hybrid" ? "混合检索" : "混合检索 + 重排"}</span>
          <button type="submit" className="send-button" disabled={!chart || !question.trim() || loading} title="发送">
            <ArrowUp size={18} />
          </button>
        </div>
      </form>
    </main>
  );
}

