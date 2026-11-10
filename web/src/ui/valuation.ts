/** Tabela "Múltiplos e caixa" da aba Valuation. Só formata: os múltiplos vêm de `finance.ts` e o resto, da fonte. */
import { fmtNum } from "../lib/format.ts";
import { valHash, type Route, type ValKey } from "../lib/router.ts";
import { h, type VNode } from "../lib/vdom.ts";
import type { ViewModel } from "./model.ts";

const dash = "—";
const x = (v: number | null, d: number): string => (v === null ? dash : `${fmtNum(v, d)}x`);
const pct = (v: number | null, d: number): string => (v === null ? dash : `${fmtNum(v, d)}%`);
const tone = (v: number | null): string => (v === null ? "muted" : v < 0 ? "neg" : "");

const COLS: { key: ValKey; label: string }[] = [
  { key: "name", label: "Empresa" },
  { key: "marketCapB", label: "Valor de mercado" },
  { key: "pe", label: "P/E TTM" },
  { key: "peCore", label: "P/E core*" },
  { key: "peFwd", label: "P/E fwd" },
  { key: "evEbitda", label: "EV/EBITDA" },
  { key: "divYield", label: "Div. yield" },
  { key: "fcfYield", label: "FCF yield" },
  { key: "fcfB", label: "FCF TTM" },
  { key: "grossMargin", label: "Margem bruta" },
  { key: "net", label: "Caixa líq." },
  { key: "evSales", label: "EV/Vendas" },
];

type Company = ViewModel["companies"][number];

/** Valor de ordenação de uma coluna; null = sem dado (vai sempre ao fim, em qualquer direção). Dividendo zero conta como sem dado, como na exibição. */
function sortValue(m: ViewModel, c: Company, key: ValKey): number | string | null {
  const v = m.derived[c.ticker].valuation;
  const e = m.valuationExtras[c.ticker] ?? { divYield: null, grossMargin: null };
  switch (key) {
    case "name": return m.names[c.ticker] ?? c.ticker;
    case "marketCapB": return c.marketCapB;
    case "divYield": return e.divYield !== null && e.divYield > 0 ? e.divYield : null;
    case "grossMargin": return e.grossMargin;
    default: return v[key];
  }
}

export function sortValuation(m: ViewModel, key: ValKey, dir: 1 | -1): Company[] {
  const keyed = m.companies.map((c) => ({ c, v: sortValue(m, c, key) }));
  keyed.sort((a, b) => {
    if (a.v === null || b.v === null) return a.v === b.v ? a.c.ticker.localeCompare(b.c.ticker) : a.v === null ? 1 : -1;
    const d = typeof a.v === "string" || typeof b.v === "string" ? String(a.v).localeCompare(String(b.v), "pt-BR") : a.v - b.v;
    return d !== 0 ? d * dir : a.c.ticker.localeCompare(b.c.ticker);
  });
  return keyed.map((k) => k.c);
}

export function valuationTable(route: Route, m: ViewModel): VNode {
  const { valSort, valDir } = route;
  const rows = sortValuation(m, valSort, valDir);
  const body = rows.map((c) => {
    const v = m.derived[c.ticker].valuation;
    const e = m.valuationExtras[c.ticker] ?? { divYield: null, grossMargin: null };
    const div = e.divYield !== null && e.divYield > 0 ? `${fmtNum(e.divYield, 2)}%` : dash;
    return h(
      "tr",
      {},
      h("th", { scope: "row" }, m.names[c.ticker] ?? c.ticker, " ", h("span", { class: "muted" }, c.ticker)),
      h("td", { class: "num" }, fmtNum(c.marketCapB, 0)),
      h("td", { class: "num" }, x(v.pe, 1)),
      h("td", { class: "num" }, v.peCore === null ? dash : `~${fmtNum(v.peCore, 1)}x`),
      h("td", { class: "num" }, x(v.peFwd, 0)),
      h("td", { class: "num" }, x(v.evEbitda, 1)),
      h("td", { class: "num" }, div),
      h("td", { class: `num ${tone(v.fcfYield)}` }, pct(v.fcfYield, 1)),
      h("td", { class: `num ${tone(v.fcfB)}` }, v.fcfB === null ? dash : fmtNum(v.fcfB, 0)),
      h("td", { class: "num" }, pct(e.grossMargin, 1)),
      h("td", { class: `num ${tone(v.net)}` }, v.net === null ? dash : `${v.net >= 0 ? "+" : ""}${fmtNum(v.net, 0)}`),
      h("td", { class: "num" }, x(v.evSales, 1)),
    );
  });
  const heads = COLS.map((c) => {
    const active = c.key === valSort;
    const next = active ? (valDir === -1 ? 1 : -1) : -1; // mesmo clique inverte; coluna nova começa decrescente
    return h(
      "th",
      { scope: "col", "aria-sort": active ? (valDir === 1 ? "ascending" : "descending") : "none" },
      h("a", { href: valHash(c.key, next as 1 | -1), class: "sortl" }, c.label, active ? (valDir === 1 ? " ▲" : " ▼") : ""),
    );
  });
  return h(
    "section",
    { class: "card", "aria-labelledby": "val-title" },
    h("h2", { id: "val-title" }, "Múltiplos e caixa"),
    h("p", { class: "sub" }, "Clique nos cabeçalhos para ordenar (sem dado vai ao fim). US$ bilhões, exceto múltiplos e percentuais. EV = valor de mercado − caixa líquido; EV/Vendas sobre a receita dos últimos 4 trimestres. * P/E core exclui itens não recorrentes; — = não disponível."),
    h(
      "div",
      { class: "tw" },
      h("table", {}, h("caption", {}, "Múltiplos e caixa por empresa"), h("thead", {}, h("tr", {}, ...heads)), h("tbody", {}, ...body)),
    ),
  );
}
