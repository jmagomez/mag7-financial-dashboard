/**
 * LineFrame: gráfico de linhas (várias empresas × períodos) em SVG próprio, com resumo em texto, rótulo direto no fim
 * de cada linha (a cor nunca é o único sinal: séries 5–7 também mudam o tracejado) e tabela alternativa completa.
 */
import { fmtNum } from "../lib/format.ts";
import { niceTicks, spreadLabels } from "../lib/history.ts";
import { h, type VNode } from "../lib/vdom.ts";

export interface Series {
  label: string;
  values: (number | null)[];
}
export interface LineSpec {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  /** Sufixo exibido nas células ("%" ou ""). A unidade em palavras vai no `subtitle`. */
  suffix: string;
  periods: string[];
  series: Series[];
}

const W = 760;
const H = 380;
const ML = 48;
const MR = 70;
const MT = 12;
const MB = 30;
export const PALETTE_SIZE = 7;

export function lineFrame(spec: LineSpec): VNode {
  const all = spec.series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const lo = Math.min(0, ...all);
  const hi = Math.max(0, ...all);
  const { ticks, min, max } = niceTicks(lo, hi, 5);
  const n = spec.periods.length;
  const x = (i: number): number => (n <= 1 ? (ML + W - MR) / 2 : ML + (i / (n - 1)) * (W - ML - MR));
  const y = (v: number): number => MT + (1 - (v - min) / (max - min)) * (H - MT - MB);

  const grid = ticks.map((t) =>
    h(
      "g",
      {},
      h("line", { x1: ML, x2: W - MR, y1: y(t), y2: y(t), class: t === 0 ? "axis0" : "grid" }),
      h("text", { x: ML - 6, y: y(t) + 4, class: "tick end" }, fmtNum(t, 0)),
    ),
  );
  const xl = spec.periods.map((p, i) => h("text", { x: x(i), y: H - 8, class: "tick mid" }, p));

  const ends = spec.series.map((s) => {
    for (let i = s.values.length - 1; i >= 0; i--) if (s.values[i] !== null && s.values[i] !== undefined) return { i, v: s.values[i] as number };
    return null;
  });
  const labelY = spreadLabels(ends.map((e) => (e ? y(e.v) + 4 : 0)), 14, MT + 6, H - MB);

  const lines = spec.series.map((s, k) => {
    const cls = `l${k % PALETTE_SIZE}`;
    const segs: string[] = [];
    let cur: string[] = [];
    s.values.forEach((v, i) => {
      if (v === null || v === undefined) {
        if (cur.length) segs.push(cur.join(" "));
        cur = [];
      } else cur.push(`${cur.length ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
    });
    if (cur.length) segs.push(cur.join(" "));
    const e = ends[k];
    return h(
      "g",
      {},
      ...segs.map((d) => h("path", { d, class: `ln ${cls}` })),
      ...s.values.map((v, i) => (v === null || v === undefined ? null : h("circle", { cx: x(i).toFixed(1), cy: y(v).toFixed(1), r: 2.5, class: `pt ${cls}` }))),
      e ? h("text", { x: x(e.i) + 8, y: labelY[k] as number, class: "endl" }, s.label) : null,
    );
  });

  const table = h(
    "table",
    {},
    h("caption", {}, `${spec.title} (${spec.subtitle})`),
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Empresa"), ...spec.periods.map((p) => h("th", { scope: "col" }, p)))),
    h(
      "tbody",
      {},
      ...spec.series.map((s) =>
        h("tr", {}, h("th", { scope: "row" }, s.label), ...s.values.map((v) => h("td", { class: "num" }, v === null || v === undefined ? "n/d" : `${fmtNum(v, 1)}${spec.suffix}`))),
      ),
    ),
  );

  return h(
    "figure",
    { class: "chart full", id: spec.id },
    h("figcaption", {}, spec.title),
    h("p", { class: "sub" }, spec.subtitle),
    h("p", { class: "summary" }, spec.summary),
    h("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${spec.title}. ${spec.summary}`, preserveAspectRatio: "xMinYMin meet" }, ...grid, ...xl, ...lines),
    h("details", { class: "alt", open: true }, h("summary", {}, "Tabela com todos os valores"), h("div", { class: "tw" }, table)),
  );
}
