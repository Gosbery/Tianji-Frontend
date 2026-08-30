"use client";

import { CalendarDays, Clock3, RefreshCw } from "lucide-react";
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
  onBirthChange: (birth: BirthInput) => void;
  onCalculate: () => void;
  onPillarClick: (pillar: Pillar) => void;
};

export function ChartPanel({
  birth,
  chart,
  activePillar,
  loading,
  onBirthChange,
  onCalculate,
  onPillarClick,
}: Props) {
  return (
    <aside className="chart-panel" aria-label="命盘">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">CHART FACTS</p>
          <h2>四柱命盘</h2>
        </div>
        {chart && <span className="status-dot">已计算</span>}
      </div>

      <div className="birth-form">
        <label>
          <span><CalendarDays size={14} />出生日期</span>
          <input
            type="date"
            value={birth.date}
            onChange={(event) => onBirthChange({ ...birth, date: event.target.value })}
          />
        </label>
        <label>
          <span><Clock3 size={14} />出生时间</span>
          <input
            type="time"
            value={birth.time}
            onChange={(event) => onBirthChange({ ...birth, time: event.target.value })}
          />
        </label>
        <button className="secondary-button calculate-button" onClick={onCalculate} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} />
          {loading ? "计算中" : "重新排盘"}
        </button>
      </div>

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

