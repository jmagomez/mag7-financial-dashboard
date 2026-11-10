/** Tabela "Múltiplos e caixa" da aba Valuation. Só formata: os múltiplos vêm de `finance.ts` e o resto, da fonte. */
import { fmtNum } from "../lib/format.ts";
import { h, type VNode } from "../lib/vdom.ts";
import type { ViewModel } from "./model.ts";

const dash = "—";
const x = (v: number | null, d: number): string => (v === null ? dash : `${fmtNum(v, d)}x`);
const pct = (v: number | null, d: number): string => (v === null ? dash : `${fmtNum(v, d)}%`);
const tone = (v: number | null): string => (v === null ? "muted" : v < 0 ? "neg" : "");

export function valuationTable(m: ViewModel): VNode {
  const rows = [...m.companies].sort((a, b) => b.marketCapB - a.marketCapB);
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
  const heads = ["Empresa", "Valor de mercado", "P/E TTM", "P/E core*", "P/E fwd", "EV/EBITDA", "Div. yield", "FCF yield", "FCF TTM", "Margem bruta", "Caixa líq.", "EV/Vendas"];
  return h(
    "section",
    { class: "card", "aria-labelledby": "val-title" },
    h("h2", { id: "val-title" }, "Múltiplos e caixa"),
    h("p", { class: "sub" }, "US$ bilhões, exceto múltiplos e percentuais. EV = valor de mercado − caixa líquido; EV/Vendas sobre a receita dos últimos 4 trimestres. * P/E core exclui itens não recorrentes; — = não disponível."),
    h(
      "div",
      { class: "tw" },
      h("table", {}, h("caption", {}, "Múltiplos e caixa por empresa"), h("thead", {}, h("tr", {}, ...heads.map((t) => h("th", { scope: "col" }, t)))), h("tbody", {}, ...body)),
    ),
  );
}
