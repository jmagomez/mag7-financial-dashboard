/**
 * Dispersão crescimento × valuation (SVG próprio): x = crescimento de receita a/a, y = EV/EBITDA em escala log,
 * área da bolha ∝ valor de mercado. Cada ponto tem rótulo de texto (a cor nunca é o único sinal), resumo e tabela alternativa.
 */
import { fmtNum } from "../lib/format.ts";
import { niceTicks } from "../lib/history.ts";
import { PALETTE_SIZE } from "./line-frame.ts";
import { h, type VNode } from "../lib/vdom.ts";
import type { ViewModel } from "./model.ts";

export interface Dot {
  label: string;
  growth: number | null;
  multiple: number | null;
  capB: number;
}

const LOG_TICKS = [5, 10, 20, 30, 50, 100, 150, 200, 300, 500, 1000];

/** Eixo log para múltiplos positivos: min = maior tick ≤ menor valor; max = menor tick ≥ maior valor. */
export function multipleAxis(values: readonly number[]): { ticks: number[]; min: number; max: number } {
  const pos = values.filter((v) => v > 0);
  if (!pos.length) return { ticks: [10, 100], min: 10, max: 100 };
  const lo = Math.min(...pos);
  const hi = Math.max(...pos);
  const min = [...LOG_TICKS].reverse().find((t) => t <= lo) ?? lo;
  const max = LOG_TICKS.find((t) => t >= hi) ?? hi;
  return { ticks: LOG_TICKS.filter((t) => t >= min && t <= max), min, max };
}

export function dots(m: ViewModel): Dot[] {
  const annual = new Map(m.rows.map((r) => [r.ticker, r.annual]));
  return m.companies.map((c) => ({
    label: m.names[c.ticker] ?? c.ticker,
    growth: annual.get(c.ticker)?.revGrowth ?? null,
    multiple: m.derived[c.ticker].valuation.evEbitda,
    capB: c.marketCapB,
  }));
}

const W = 760;
const H = 400;
const ML = 52;
const MR = 24;
const MT = 14;
const MB = 44;

export function scatterFrame(m: ViewModel): VNode {
  const all = dots(m);
  const pts = all.filter((d): d is Dot & { growth: number; multiple: number } => d.growth !== null && d.multiple !== null && d.multiple > 0);
  const missing = all.filter((d) => !pts.includes(d as never)).map((d) => d.label);
  const xs = pts.map((p) => p.growth);
  const xAxis = niceTicks(Math.min(0, ...xs), Math.max(0, ...xs), 6);
  const yAxis = multipleAxis(pts.map((p) => p.multiple));
  const x = (v: number): number => ML + ((v - xAxis.min) / (xAxis.max - xAxis.min || 1)) * (W - ML - MR);
  const ly = (v: number): number => Math.log10(v);
  const y = (v: number): number => MT + (1 - (ly(v) - ly(yAxis.min)) / (ly(yAxis.max) - ly(yAxis.min) || 1)) * (H - MT - MB);
  const maxCap = Math.max(1, ...pts.map((p) => p.capB));
  const r = (cap: number): number => 5 + 15 * Math.sqrt(Math.max(0, cap) / maxCap);

  const grid = [
    ...yAxis.ticks.map((t) => h("g", {}, h("line", { x1: ML, x2: W - MR, y1: y(t), y2: y(t), class: "gl" }), h("text", { x: ML - 6, y: y(t) + 4, class: "tick end" }, `${fmtNum(t, 0)}x`))),
    ...xAxis.ticks.map((t) => h("g", {}, h("line", { x1: x(t), x2: x(t), y1: MT, y2: H - MB, class: t === 0 ? "axis0" : "gl" }), h("text", { x: x(t), y: H - MB + 16, class: "tick mid" }, `${fmtNum(t, 0)}%`))),
    h("text", { x: (ML + W - MR) / 2, y: H - 6, class: "tick mid" }, "Crescimento de receita a/a (último ano fiscal)"),
  ];
  const bubbles = pts.map((p, k) =>
    h(
      "g",
      {},
      h("circle", { cx: x(p.growth).toFixed(1), cy: y(p.multiple).toFixed(1), r: r(p.capB).toFixed(1), class: `bub pt l${k % PALETTE_SIZE}` }),
      h("text", { x: (x(p.growth) + r(p.capB) + 4).toFixed(1), y: (y(p.multiple) + 4).toFixed(1), class: "endl" }, p.label),
    ),
  );

  const top = [...pts].sort((a, b) => b.multiple - a.multiple)[0];
  const fast = [...pts].sort((a, b) => b.growth - a.growth)[0];
  const summary = [
    top ? `Maior múltiplo: ${top.label}, ${fmtNum(top.multiple, 1)}x EV/EBITDA.` : "Sem dados válidos.",
    fast ? `Maior crescimento: ${fast.label}, ${fmtNum(fast.growth, 1)}% a/a.` : "",
    missing.length ? `Sem dado para o gráfico: ${missing.join(", ")}.` : "",
    "Quadrante mais atraente: crescimento alto (à direita) com múltiplo baixo (embaixo). Área da bolha proporcional ao valor de mercado.",
  ]
    .filter(Boolean)
    .join(" ");

  const table = h(
    "table",
    {},
    h("caption", {}, "Crescimento de receita × EV/EBITDA × valor de mercado"),
    h("thead", {}, h("tr", {}, ...["Empresa", "Crescimento a/a (%)", "EV/EBITDA (x)", "Valor de mercado (US$ bi)"].map((t) => h("th", { scope: "col" }, t)))),
    h(
      "tbody",
      {},
      ...all.map((d) =>
        h("tr", {}, h("th", { scope: "row" }, d.label), h("td", { class: "num" }, fmtNum(d.growth, 1)), h("td", { class: "num" }, fmtNum(d.multiple, 1)), h("td", { class: "num" }, fmtNum(d.capB, 0))),
      ),
    ),
  );

  return h(
    "figure",
    { class: "chart full", id: "c-scatter" },
    h("figcaption", {}, "Crescimento × valuation"),
    h("p", { class: "sub" }, "Crescimento de receita a/a × EV/EBITDA (escala log) · área da bolha = valor de mercado"),
    h("p", { class: "summary" }, summary),
    h("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Crescimento × valuation. ${summary}`, preserveAspectRatio: "xMinYMin meet" }, ...grid, ...bubbles),
    h("details", { class: "alt" }, h("summary", {}, "Ver como tabela"), h("div", { class: "tw" }, table)),
  );
}
