import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerificationList } from "@/components/VerificationList";
import type { Evidence } from "@/lib/types";

const hit: Evidence = {
  id: "card-1",
  kind: "knowledge_card",
  layer: 3,
  title: "《滴天髓》· 配合",
  quote: "配合干支，仔细推详其进退之机。",
  source: "test",
  score: 1.2,
  matched_by: ["bm25"],
  trace_refs: [],
  review_status: "reviewed",
  verification_level: "human_review",
  confidence: 0.95,
  warning: "",
  unresolved_variants: [],
  concepts: [],
};

describe("VerificationList", () => {
  it("renders classic evidence entries with count", () => {
    render(<VerificationList hits={[hit]} />);
    expect(screen.getByText("典籍依据 · 1 条")).toBeDefined();
    expect(screen.getByText(/配合干支/)).toBeDefined();
  });

  it("shows loading and error states", () => {
    render(<VerificationList hits={[]} loading />);
    expect(screen.getByText("正在检索典籍…")).toBeDefined();
    render(<VerificationList hits={[]} error="请求失败" />);
    expect(screen.getByText("请求失败")).toBeDefined();
  });

  it("renders every hit with its title and source attributed", () => {
    const second: Evidence = {
      ...hit,
      id: "card-2",
      title: "《子平真诠》· 论用神",
      quote: "用神不可损伤。",
      source: "子平真诠 §4",
    };
    render(<VerificationList hits={[hit, second]} />);

    expect(screen.getByText("典籍依据 · 2 条")).toBeDefined();
    expect(screen.getByText("《滴天髓》· 配合")).toBeDefined();
    expect(screen.getByText("《子平真诠》· 论用神")).toBeDefined();
    expect(screen.getByText("子平真诠 §4")).toBeDefined();
    expect(screen.getByText(/用神不可损伤/)).toBeDefined();
  });

  it("explains an empty result instead of rendering a bare list", () => {
    render(<VerificationList hits={[]} />);

    expect(screen.getByText("未检索到相关典籍条文。")).toBeDefined();
    expect(screen.queryByText(/典籍依据 ·/)).toBeNull();
  });
});
