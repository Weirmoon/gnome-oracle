"use client";

import { useState } from "react";
import { MODEL_CATALOG } from "@/lib/providers/catalog";
import { BENCHMARK, BENCHMARK_CONDITIONS, BENCHMARK_DATE, type BenchmarkRow, type Verdict } from "@/lib/providers/benchmark";

// Validated against the panel surface (dataviz validator, dark mode): lightness band, CVD and contrast pass.
const BAR = "#9a78e6";
const BAR_SELECTED = "#b8862a";

const VERDICT: Record<Verdict, string> = { right: "✅ Right", partly: "🟡 Partly", wrong: "❌ Wrong", empty: "⚠️ Empty", leaked: "⚠️ Leaked reasoning" };

interface Metric { key: keyof BenchmarkRow; title: string; unit: string; better: "lower" | "higher" }
const METRICS: Metric[] = [
  { key: "ramGb", title: "Memory while loaded", unit: "GB", better: "lower" },
  { key: "tokensPerSecond", title: "Writing speed", unit: "tokens/s", better: "higher" },
  { key: "answerSeconds", title: "Time to a full answer", unit: "s", better: "lower" },
  { key: "quipSeconds", title: "Time to a critter quip", unit: "s", better: "lower" },
];

/** One measure per chart: horizontal bars sorted best-first, the selected model marked in gold and with ★. */
function BarChart({ metric, rows, selected }: { metric: Metric; rows: BenchmarkRow[]; selected: string }) {
  const values = rows.map(row => ({ id: row.id, value: Number(row[metric.key]) }));
  values.sort((a, b) => metric.better === "lower" ? a.value - b.value : b.value - a.value);
  const max = Math.max(...values.map(v => v.value));
  return <figure style={{ margin: 0, minWidth: 0 }}>
    <figcaption style={{ fontWeight: 600, marginBottom: 6 }}>{metric.title} <span className="muted" style={{ fontWeight: 400 }}>({metric.unit}, {metric.better} is better)</span></figcaption>
    <div role="list" style={{ display: "grid", gap: 2 }}>
      {values.map(({ id, value }) => {
        const isSelected = id === selected;
        return <div role="listitem" key={id} title={`${id}: ${value} ${metric.unit}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 9.5em) minmax(0, 1fr)", gap: 8, alignItems: "center", fontSize: "0.8em", padding: "1px 0" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isSelected ? 700 : 400 }}>{isSelected ? "★ " : ""}{id}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span aria-hidden style={{ height: 10, width: `${Math.max(2, value / max * 100)}%`, background: isSelected ? BAR_SELECTED : BAR, borderRadius: "0 4px 4px 0", flexShrink: 1 }} />
            <span style={{ color: "var(--text)", whiteSpace: "nowrap" }}>{value}{isSelected ? " (selected)" : ""}</span>
          </span>
        </div>;
      })}
    </div>
  </figure>;
}

/** Guide and benchmark for choosing a model: what each is for, and how they measured. */
export default function ModelGuide({ selected }: { selected: string }) {
  const [view, setView] = useState<"charts" | "table">("charts");
  const cellStyle = { padding: "6px 8px", borderTop: "1px solid rgba(255,255,255,0.08)", verticalAlign: "top" } as const;
  const headStyle = { ...cellStyle, textAlign: "left", position: "sticky", top: 0, background: "var(--bg2)" } as const;
  // minmax(0, 1fr) lets wide tables scroll inside their boxes instead of widening the panel.
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14, minWidth: 0 }}>
    <details>
      <summary>Which model should I use?</summary>
      <div style={{ overflowX: "auto", maxWidth: "100%", marginTop: 8 }}>
        <table style={{ borderCollapse: "collapse", fontSize: "0.85em", minWidth: 640 }}>
          <thead><tr><th style={headStyle}>Model</th><th style={headStyle}>Best at</th><th style={headStyle}>Weak at</th><th style={headStyle}>Use when</th><th style={headStyle}>Needs</th></tr></thead>
          <tbody>{MODEL_CATALOG.map(model => <tr key={model.id} style={model.id === selected ? { background: "rgba(184,134,42,0.15)" } : undefined}>
            <td style={cellStyle}><strong>{model.id === selected ? "★ " : ""}{model.label}</strong><br /><code>{model.id}</code>{model.thinking ? " 🧠" : ""}</td>
            <td style={cellStyle}>{model.bestAt}</td>
            <td style={cellStyle}>{model.weakAt}</td>
            <td style={cellStyle}>{model.useWhen}</td>
            <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>~{model.minRamGb} GB RAM<br />{model.sizeGb} GB disk<br />CPU is fine</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
    <details>
      <summary>Benchmark results</summary>
      <p className="muted" style={{ fontSize: "0.85em" }}>Measured {BENCHMARK_DATE}. {BENCHMARK_CONDITIONS}</p>
      <div role="tablist" style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {(["charts", "table"] as const).map(name => <button key={name} type="button" role="tab" aria-selected={view === name} className={view === name ? undefined : "ghost"} onClick={() => setView(name)}>{name === "charts" ? "Charts" : "Table"}</button>)}
      </div>
      {view === "charts" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 18 }}>
        {METRICS.map(metric => <BarChart key={metric.key} metric={metric} rows={BENCHMARK} selected={selected} />)}
      </div> : <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table style={{ borderCollapse: "collapse", fontSize: "0.8em", minWidth: 760 }}>
          <thead><tr>{["Model", "RAM (GB)", "Speed (tok/s)", "Answer (s)", "Quip (s)", "Facts", "Maths", "Maths, thinking", "Persona JSON"].map(h => <th key={h} style={headStyle}>{h}</th>)}</tr></thead>
          <tbody>{BENCHMARK.map(row => <tr key={row.id} style={row.id === selected ? { background: "rgba(184,134,42,0.15)" } : undefined}>
            <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{row.id === selected ? "★ " : ""}<code>{row.id}</code></td>
            <td style={cellStyle}>{row.ramGb}</td>
            <td style={cellStyle}>{row.tokensPerSecond}</td>
            <td style={cellStyle}>{row.answerSeconds}</td>
            <td style={cellStyle}>{row.quipSeconds}</td>
            <td style={cellStyle}>{VERDICT[row.facts]}</td>
            <td style={cellStyle}>{VERDICT[row.maths]}</td>
            <td style={cellStyle}>{row.thinkingMaths ? `${VERDICT[row.thinkingMaths]} (${row.thinkingSeconds}s)` : "—"}</td>
            <td style={cellStyle}>{row.personaJson ? `✅ ${row.personaSeconds}s` : "❌ Invalid"}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <p className="muted" style={{ fontSize: "0.8em" }}>Also tested and left out of the list: <code>qwen3:4b</code> (thinking-only; its reasoning leaks into answers) and <code>deepseek-r1:1.5b</code> (often returns empty answers).</p>
    </details>
  </div>;
}
