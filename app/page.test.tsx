import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import {
  archiveTask,
  calculateChart,
  createTask,
  getExperts,
  getTask,
  listTasks,
  renameTask,
  restoreTask,
} from "@/lib/api";
import type { ChartFacts, ResearchTaskDetail } from "@/lib/types";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    archiveTask: vi.fn(),
    calculateChart: vi.fn(),
    cancelTaskJob: vi.fn(),
    createTask: vi.fn(),
    getExperts: vi.fn(),
    getTask: vi.fn(),
    listTasks: vi.fn(),
    renameTask: vi.fn(),
    restoreTask: vi.fn(),
    retryTaskJob: vi.fn(),
    sendFeedback: vi.fn(),
    sendTaskMessage: vi.fn(),
  };
});

const chart: ChartFacts = {
  calculated_at: "2026-09-04T00:00:00Z",
  birth: {
    date: "1990-01-01",
    time: "12:00",
    gender: "male",
    timezone: "Asia/Shanghai",
    name: "测试",
  },
  pillars: [
    { key: "year", label: "年柱", stem: "庚", branch: "午", stem_element: "金", stem_yin_yang: "阳", branch_element: "火", hidden_stems: ["丁"], ten_god_stem: "偏财", ten_god_branches: ["伤官"], nayin: "路旁土" },
    { key: "month", label: "月柱", stem: "戊", branch: "子", stem_element: "土", stem_yin_yang: "阳", branch_element: "水", hidden_stems: ["癸"], ten_god_stem: "食神", ten_god_branches: ["正官"], nayin: "霹雳火" },
    { key: "day", label: "日柱", stem: "甲", branch: "辰", stem_element: "木", stem_yin_yang: "阳", branch_element: "土", hidden_stems: ["戊"], ten_god_stem: "", ten_god_branches: ["偏财"], nayin: "覆灯火" },
    { key: "time", label: "时柱", stem: "壬", branch: "午", stem_element: "水", stem_yin_yang: "阳", branch_element: "火", hidden_stems: ["丁"], ten_god_stem: "偏印", ten_god_branches: ["伤官"], nayin: "杨柳木" },
  ],
  day_master: "甲",
  day_master_element: "木",
  day_master_yin_yang: "阳",
  month_command: { branch: "子", main_hidden_stem: "癸", ten_god: "正印" },
  exposed_stems: [],
  roots: [],
  structural_relations: [],
  pattern_candidates: [],
  luck: {
    direction: "forward",
    direction_label: "顺排",
    start_at: "1995-01-01T00:00:00",
    start_offset_years: 5,
    start_offset_months: 0,
    start_offset_days: 0,
    start_offset_hours: 0,
    method: "test",
    cycles: [],
    current_cycle: null,
    next_cycle: null,
  },
  calculation_basis: "test",
  uncertainties: [],
};

function task(id: string, name: string, archived = false): ResearchTaskDetail {
  return {
    id,
    title: `${name} · 梁湘润方法`,
    expert_id: "liang-xiangrun",
    expert_version: "0.1-preview",
    expert_name: "梁湘润方法",
    birth: { ...chart.birth, name },
    chart: { ...chart, birth: { ...chart.birth, name } },
    school: "子平格局法",
    evidence_scope: "personal_preview",
    mode: "hybrid_rerank",
    archived,
    created_at: "2026-09-04T00:00:00Z",
    updated_at: "2026-09-04T00:00:00Z",
    active_job: null,
    messages: [],
  };
}

const experts = {
  default_expert_id: "liang-xiangrun",
  experts: [
    {
      id: "comprehensive",
      display_name: "综合研究",
      version: "1.0",
      review_status: "reviewed" as const,
      allowed_schools: ["基础共识"],
      preferred_schools: ["基础共识"],
      methodology: ["证据优先"],
      boundaries: ["不冒充人物"],
      attribution: "项目方法",
      is_default: false,
    },
    {
      id: "liang-xiangrun",
      display_name: "梁湘润方法",
      version: "0.1-preview",
      review_status: "machine_verified" as const,
      allowed_schools: ["基础共识", "子平格局法"],
      preferred_schools: ["子平格局法"],
      methodology: ["月令与格局", "成败救应"],
      boundaries: ["不冒充人物"],
      attribution: "研究摘要",
      is_default: true,
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getExperts).mockReset().mockResolvedValue(experts);
  vi.mocked(listTasks).mockReset().mockResolvedValue({ tasks: [] });
  vi.mocked(getTask).mockReset();
  vi.mocked(calculateChart).mockReset().mockResolvedValue(chart);
  vi.mocked(createTask).mockReset();
  vi.mocked(renameTask).mockReset();
  vi.mocked(archiveTask).mockReset();
  vi.mocked(restoreTask).mockReset();
});

describe("multi-expert task workspace", () => {
  it("opens the creation view and defaults to the Liang methodology", async () => {
    render(<Home />);

    expect(await screen.findByRole("heading", { name: "选择分析方法" })).toBeDefined();
    expect(screen.getByRole("button", { name: /梁湘润方法/ }).className).toContain("active");
    expect(calculateChart).toHaveBeenCalled();
  });

  it("creates a task with the selected immutable chart and expert", async () => {
    const created = task("task-created", "测试");
    vi.mocked(createTask).mockResolvedValue(created);
    vi.mocked(listTasks)
      .mockResolvedValueOnce({ tasks: [] })
      .mockResolvedValue({ tasks: [created] });
    render(<Home />);

    await screen.findByRole("heading", { name: "选择分析方法" });
    await waitFor(() => expect(screen.getByRole("button", { name: "创建任务" })).toHaveProperty("disabled", false));
    fireEvent.click(screen.getByRole("button", { name: "创建任务" }));

    await screen.findByText("测试 · 梁湘润方法");
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ expertId: "liang-xiangrun" }));
    expect(screen.queryByRole("button", { name: "预览命盘" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "知识流派" })).toBeNull();
  });

  it("restores the latest task and switches without modifying either chart", async () => {
    const first = task("task-first", "甲");
    const second = task("task-second", "乙");
    vi.mocked(listTasks).mockResolvedValue({ tasks: [first, second] });
    vi.mocked(getTask).mockImplementation(async (id) => id === first.id ? first : second);
    render(<Home />);

    await screen.findByText("甲 · 梁湘润方法");
    fireEvent.click(screen.getByRole("button", { name: "乙 · 梁湘润方法梁湘润方法" }));
    await waitFor(() => expect(getTask).toHaveBeenLastCalledWith("task-second"));
    expect(screen.getByDisplayValue("乙")).toHaveProperty("readOnly", true);
  });

  it("renames a task from the sidebar", async () => {
    const existing = task("task-one", "测试");
    vi.mocked(listTasks).mockResolvedValue({ tasks: [existing] });
    vi.mocked(getTask).mockResolvedValue(existing);
    vi.mocked(renameTask).mockResolvedValue({ ...existing, title: "新的标题" });
    render(<Home />);

    await screen.findByText(existing.title);
    fireEvent.click(screen.getByRole("button", { name: `重命名 ${existing.title}` }));
    fireEvent.change(screen.getByRole("textbox", { name: "任务标题" }), { target: { value: "新的标题" } });
    fireEvent.click(screen.getByRole("button", { name: "保存任务标题" }));

    await waitFor(() => expect(renameTask).toHaveBeenCalledWith(existing.id, "新的标题"));
  });

  it("archives without deleting and exposes restoration in the archive group", async () => {
    const existing = task("task-one", "测试");
    const archived = task("task-one", "测试", true);
    vi.mocked(listTasks)
      .mockResolvedValueOnce({ tasks: [existing] })
      .mockResolvedValue({ tasks: [archived] });
    vi.mocked(getTask).mockResolvedValue(existing);
    vi.mocked(archiveTask).mockResolvedValue(archived);
    render(<Home />);

    await screen.findByText(existing.title);
    fireEvent.click(screen.getByRole("button", { name: `归档 ${existing.title}` }));
    await screen.findByRole("button", { name: /已归档/ });
    fireEvent.click(screen.getByRole("button", { name: /已归档/ }));
    expect(screen.getByRole("button", { name: `恢复 ${existing.title}` })).toBeDefined();
  });
});
