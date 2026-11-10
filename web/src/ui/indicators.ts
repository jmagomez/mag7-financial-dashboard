/** Aba Indicadores: seletor de período, KPIs, gráficos do período, tabela comparativa ordenável e notas por empresa. */
import { fmtDate, fmtNum } from "../lib/format.ts";
import { kpis, priceDeltas, sortRows, type IndRow } from "../lib/indicators.ts";
import { indHash, PERIODS, SORT_KEYS, type Period, type Route, type SortKey } from "../lib/router.ts";
import { h, type VNode } from "../lib/vdom.ts";
import type { BarDatum, ChartSpec } from "./chart-frame.ts";
import { ranked } from "./chart-frame.ts";
import type { ViewModel } from "./model.ts";
import { PERIOD_CAPTION, TABLE_NOTE } from "./notes.ts";

const periodLabel = (m: ViewModel, p: Period): string => (p === "annual" ? m.annualLabel : m.quarterLabel);

export function periodNav(route: Route, m: ViewModel): VNode {
  return h(
    "div",
    { class: "stack-sm" },
    h(
      "nav",
      { class: "seg", "aria-label": "Período dos indicadores" },
      ...PERIODS.map((x) => h("a", { href: indHash(x.id, route.sort, route.dir), "aria-current": x.id === route.period ? "page" : undefined }, `${x.label} · ${periodLabel(m, x.id)}`)),
    ),
    h("p", { class: "sub" }, PERIOD_CAPTION[route.period]),
  );
}

export function kpiBlock(m: ViewModel, period: Period): VNode {
  return h(
    "section",
    { "aria-label": "Totais das sete empresas" },
    h("div", { class: "kpis" }, ...kpis(m.rows, period).map((k) => h("div", { class: "kpi" }, h("div", { class: "l" }, k.label), h("div", { class: "v" }, k.value)))),
  );
}

function leader(data: BarDatum[], unit: string, digits: number, what: string): string {
  const top = ranked(data).find((d) => d.value !== null);
  return top && top.value !== null ? `${what}: ${top.label}, ${fmtNum(top.value, digits)} ${unit}.` : "Sem dados válidos.";
}

type Pick = (r: IndRow, p: Period) => number | null;
const bars = (m: ViewModel, period: Period, pick: Pick): BarDatum[] => m.rows.map((r) => ({ label: r.name, value: pick(r, period) }));

/** Receita, margem líquida e crescimento do período escolhido. */
export function periodCharts(m: ViewModel, period: Period): ChartSpec[] {
  const lab = periodLabel(m, period);
  const rev = bars(m, period, (r, p) => r[p].revenueB ?? null);
  const mar = bars(m, period, (r, p) => r[p].netMargin ?? null);
  const gro = bars(m, period, (r, p) => r[p].revGrowth ?? null);
  return [
    { id: "i-rev", title: `Receita (${lab})`, unit: "US$ bi", digits: 1, data: rev, summary: leader(rev, "US$ bi", 1, "Maior") },
    { id: "i-margin", title: `Margem líquida (${lab})`, unit: "%", data: mar, summary: leader(mar, "%", 1, "Maior") },
    { id: "i-growth", title: `Crescimento de receita a/a (${lab})`, unit: "%", data: gro, summary: `${leader(gro, "%", 1, "Maior")} Valores negativos aparecem na tabela.` },
  ];
}

const COLS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Empresa" },
  { key: "revenueB", label: "Receita" },
  { key: "revGrowth", label: "Cresc. a/a" },
  { key: "operatingIncomeB", label: "Lucro op." },
  { key: "netIncomeB", label: "Lucro líq." },
  { key: "netMargin", label: "Margem" },
  { key: "epsDiluted", label: "LPA" },
  { key: "marketCapB", label: "Market cap" },
  { key: "price", label: "Preço" },
];
if (COLS.length !== SORT_KEYS.length) throw new Error("COLS e SORT_KEYS divergem");

const dash = "—";
const num = (v: number | undefined, d: number): string => (v === undefined ? dash : fmtNum(v, d));
const signed = (v: number | null, d: number, suffix = ""): string => (v === null ? dash : `${v > 0 ? "+" : ""}${fmtNum(v, d)}${suffix}`);
const tone = (v: number | null | undefined): string => (v === null || v === undefined ? "muted" : v < 0 ? "neg" : "pos");

export function comparisonTable(route: Route, m: ViewModel): VNode {
  const { period, sort, dir } = route;
  const rows = sortRows(m.rows, sort, dir, period);
  const delta = priceDeltas(m.rows, m.snapshots, m.marketSnapshot);
  const head = COLS.map((c) => {
    const active = c.key === sort;
    const next = active ? (dir === -1 ? 1 : -1) : -1; // mesmo clique: inverte; coluna nova: decrescente
    return h(
      "th",
      { scope: "col", "aria-sort": active ? (dir === 1 ? "ascending" : "descending") : "none" },
      h("a", { href: indHash(period, c.key, next as 1 | -1), class: "sortl" }, c.label, active ? (dir === 1 ? " ▲" : " ▼") : ""),
    );
  });
  const body = rows.map((r) => {
    const p = r[period];
    const eps = p.epsDiluted !== undefined ? `$${fmtNum(p.epsDiluted, 2)}` : p.epsNonGaap !== undefined ? `$${fmtNum(p.epsNonGaap, 2)}*` : dash;
    const dd = delta.byTicker[r.ticker] ?? null;
    return h(
      "tr",
      {},
      h("th", { scope: "row" }, r.name, " ", h("span", { class: "muted" }, r.ticker)),
      h("td", { class: "num" }, num(p.revenueB, 1)),
      h("td", { class: `num ${tone(p.revGrowth)}` }, p.revGrowth === undefined ? dash : signed(p.revGrowth, 1, "%")),
      h("td", { class: "num" }, num(p.operatingIncomeB, 1)),
      h("td", { class: "num" }, num(p.netIncomeB, 2)),
      h("td", { class: "num" }, p.netMargin === undefined ? dash : `${fmtNum(p.netMargin, 1)}%`),
      h("td", { class: "num" }, eps),
      h("td", { class: "num" }, fmtNum(r.marketCapB, 0)),
      h("td", { class: "num" }, `$${fmtNum(r.price, 2)}`),
      h("td", { class: `num ${tone(dd)}` }, signed(dd, 2, "%")),
    );
  });
  return h(
    "section",
    { class: "card", "aria-labelledby": "cmp-title" },
    h("h2", { id: "cmp-title" }, `Comparativo — ${periodLabel(m, period)}`),
    h("p", { class: "sub" }, "Clique nos cabeçalhos para ordenar. US$ bilhões, exceto LPA e preço. * = LPA ajustado (non-GAAP)."),
    h(
      "div",
      { class: "tw" },
      h(
        "table",
        {},
        h("caption", {}, `Comparativo das empresas (${periodLabel(m, period)})`),
        h("thead", {}, h("tr", {}, ...head, h("th", { scope: "col" }, delta.from ? `Δ vs. ${fmtDate(delta.from)}` : "Δ dia"))),
        h("tbody", {}, ...body),
      ),
    ),
    h(
      "ul",
      { class: "notes" },
      ...rows.map((r) => h("li", {}, h("b", {}, r.ticker), ` · ${r[period].period ?? ""}: ${r[period].note ?? ""}`)),
      h("li", {}, ...TABLE_NOTE),
    ),
  );
}
