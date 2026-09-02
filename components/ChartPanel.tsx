"use client";

import { CalendarDays, Clock3, Globe2, RefreshCw, UserRound } from "lucide-react";
import type { FormEvent } from "react";
import type { BirthInput, ChartFacts, Pillar } from "@/lib/types";

const ELEMENT_CLASS: Record<string, string> = {
  木: "element-wood",
  火: "element-fire",
  土: "element-earth",
  金: "element-metal",
  水: "element-water",
};

type Props = {
  birth: BirthInput;
  chart: ChartFacts | null;
  activePillar: Pillar | null;
  loading: boolean;
  stale: boolean;
  onBirthChange: (birth: BirthInput) => void;
  onCalculate: () => void;
  onPillarClick: (pillar: Pillar) => void;
};

export function ChartPanel({
  birth,
  chart,
  activePillar,
  loading,
  stale,
  onBirthChange,
  onCalculate,
  onPillarClick,
}: Props) {
  return (
    <aside className="chart-panel" aria-label="命盘" aria-busy={loading}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">CHART FACTS</p>
          <h2>四柱命盘</h2>
        </div>
        {chart && (
          <span className={`status-dot ${stale ? "stale" : ""}`} role="status">
            {stale ? "待重新计算" : "已计算"}
          </span>
        )}
      </div>

      <form
        className="birth-form"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onCalculate();
        }}
      >
        <label>
          <span><UserRound size={14} aria-hidden="true" />姓名（可选）</span>
          <input
            type="text"
            value={birth.name}
            maxLength={80}
            autoComplete="name"
            placeholder="访客"
            onChange={(event) => onBirthChange({ ...birth, name: event.target.value })}
          />
        </label>
        <label>
          <span><Globe2 size={14} aria-hidden="true" />出生地时区</span>
          <input
            type="text"
            value={birth.timezone}
            readOnly
            aria-readonly="true"
          />
        </label>
        <label>
          <span><CalendarDays size={14} aria-hidden="true" />出生日期</span>
          <input
            type="date"
            value={birth.date}
            min="1900-01-01"
            max="2100-12-31"
            required
            onChange={(event) => onBirthChange({ ...birth, date: event.target.value })}
          />
        </label>
        <label>
          <span><Clock3 size={14} aria-hidden="true" />出生时间</span>
          <input
            type="time"
            value={birth.time}
            required
            onChange={(event) => onBirthChange({ ...birth, time: event.target.value })}
          />
        </label>
        <button
          type="submit"
          className="secondary-button calculate-button"
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? "spin" : ""} aria-hidden="true" />
          {loading ? "计算中" : "重新排盘"}
        </button>
      </form>

      {chart && (
        <>
          <div className="day-master-strip">
            <span>日主</span>
            <strong>{chart.day_master}</strong>
            <span>{chart.day_master_yin_yang}{chart.day_master_element}</span>
          </div>
          <div className="pillars-grid">
            {chart.pillars.map((pillar) => (
              <button
                type="button"
                key={pillar.key}
                className={`pillar ${activePillar?.key === pillar.key ? "active" : ""}`}
                onClick={() => onPillarClick(pillar)}
                aria-pressed={activePillar?.key === pillar.key}
              >
                <span className="pillar-label">{pillar.label}</span>
                <strong className={ELEMENT_CLASS[pillar.stem_element]}>{pillar.stem}</strong>
                <strong className={ELEMENT_CLASS[pillar.branch_element]}>{pillar.branch}</strong>
                <span className="ten-god">{pillar.ten_god_stem || "日主"}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {activePillar && (
        <div className="pillar-inspector">
          <div className="inspector-row"><span>藏干</span><strong>{activePillar.hidden_stems.join(" · ")}</strong></div>
          <div className="inspector-row"><span>支内十神</span><strong>{activePillar.ten_god_branches.join(" · ")}</strong></div>
          <div className="inspector-row"><span>纳音</span><strong>{activePillar.nayin}</strong></div>
        </div>
      )}
      {chart && <p className="basis-note">{chart.calculation_basis}</p>}
    </aside>
  );
}
