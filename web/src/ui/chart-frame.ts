/**
 * ChartFrame: todo gráfico sai com (1) título, (2) resumo em texto, (3) SVG com rótulo acessível e
 * (4) tabela alternativa com os mesmos números. Linhas `dim` (dado defasado) ficam esmaecidas e FORA do ranking.
 */
import { fmtNum } from "../lib/format.ts";
import type { Chip } from "../lib/freshness.ts";
import { h, type VNode } from "../lib/vdom.ts";

export interface BarDatum {
  label: string;
  value: number | null;
  chip?: Chip;
  /** Esmaecida e excluída do ranking e do resumo. */
  dim?: boolean;
  /** Cor fixa da empresa (0–6, mesma ordem de `m.companies`); sem ela a barra usa a cor de destaque. */
  slot?: number;
  /** Células extras da tabela alternativa (mesma ordem de `ChartSpec.columns`). */
  cells?: string[];
}
export interface ChartSpec {
  id: string;
  title: string;
  /** Resumo em texto, lido por leitores de tela e visível. */
  summary: string;
  unit: string;
  digits?: number;
  data: BarDatum[];
  /** Cabeçalhos das colunas extras da tabela. */
  columns?: string[];
}

/** Ordem de exibição: ranking (desc) dos válidos; depois os defasados (desc); por fim os sem valor. */
export function ranked(data: readonly BarDatum[]): BarDatum[] {
  const val = (d: BarDatum): number => d.value ?? -Infinity;
  const live = data.filter((d) => d.value !== null && !d.dim).sort((a, b) => val(b) - val(a));
  const stale = data.filter((d) => d.value !== null && d.dim).sort((a, b) => val(b) - val(a));
  const none = data.filter((d) => d.value === null);
  return [...live, ...stale, ...none];
}

const ROW = 30;
const LABEL_W = 170;
const BAR_MAX = 360;
const VALUE_W = 110;
const W = LABEL_W + BAR_MAX + VALUE_W;

export function chartFrame(spec: ChartSpec): VNode {
  const rows = ranked(spec.data);
  const digits = spec.digits ?? 1;
  const max = Math.max(0, ...rows.map((r) => r.value ?? 0));
  const height = rows.length * ROW + 8;

  const bars = rows.map((r, i) => {
    const y = i * ROW + 4;
    const w = r.value !== null && max > 0 ? Math.max(1, Math.round((Math.max(0, r.value) / max) * BAR_MAX)) : 0;
    return h(
      "g",
      {},
      h("text", { x: 0, y: y + 17, class: "lbl" }, r.label),
      w > 0 ? h("rect", { x: LABEL_W, y, width: w, height: ROW - 10, rx: 3, class: r.dim ? "bar dim" : r.slot !== undefined ? `bar c${r.slot}` : "bar" }) : null,
      h("text", { x: LABEL_W + w + 8, y: y + 17, class: r.dim ? "val dim" : "val" }, r.value === null ? "n/d" : `${fmtNum(r.value, digits)} ${spec.unit}`.trim()),
    );
  });

  const head = ["Item", `Valor (${spec.unit})`, ...(spec.columns ?? []), ...(rows.some((r) => r.chip) ? ["Idade do dado"] : [])];
  const table = h(
    "table",
    {},
    h("caption", {}, spec.title),
    h("thead", {}, h("tr", {}, ...head.map((c) => h("th", { scope: "col" }, c)))),
    h(
      "tbody",
      {},
      ...rows.map((r) =>
        h(
          "tr",
          { class: r.dim ? "dim" : undefined },
          h("th", { scope: "row" }, r.label),
          h("td", { class: "num" }, fmtNum(r.value, digits)),
          ...(r.cells ?? []).map((c) => h("td", {}, c)),
          rows.some((x) => x.chip) ? h("td", {}, r.chip ? h("span", { class: `chip chip-${r.chip.level}` }, r.chip.text) : "") : null,
        ),
      ),
    ),
  );

  return h(
    "figure",
    { class: "chart", id: spec.id },
    h("figcaption", {}, spec.title),
    h("p", { class: "summary" }, spec.summary),
    h(
      "svg",
      { viewBox: `0 0 ${W} ${height}`, role: "img", "aria-label": `${spec.title}. ${spec.summary}`, preserveAspectRatio: "xMinYMin meet" },
      ...bars,
    ),
    h("details", { class: "alt" }, h("summary", {}, "Ver como tabela"), h("div", { class: "tw" }, table)),
  );
}
