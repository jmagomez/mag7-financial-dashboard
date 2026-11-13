/** Seção do rodapé: EV ajustado por arrendamentos e participação de não controladores. Só aparece se fundamentals.json trouxer `derived.evAdjust` válido para alguma empresa. */
import { safeHttpsUrl } from "../lib/escape.ts";
import { fmtDateFull, fmtNum } from "../lib/format.ts";
import { h, type VNode } from "../lib/vdom.ts";
import type { ViewModel } from "./model.ts";

export function evAdjustedBlock(m: ViewModel): VNode | null {
  if (m.evAdj.length === 0 || !m.evAdjust) return null;
  const name = (t: string): string => m.names[t] ?? t;
  const adj = m.evAdjust;
  const missing = m.companies.map((c) => String(c.ticker)).filter((t) => !m.evAdj.some((r) => r.ticker === t));
  return h(
    "details",
    { class: "card" },
    h("summary", {}, "EV ajustado (arrendamentos e minoritários)"),
    h(
      "div",
      { class: "tw" },
      h(
        "table",
        {},
        h("caption", {}, "EV da tabela de múltiplos e EV ajustado por empresa (US$ bi)"),
        h("thead", {}, h("tr", {}, ...["Empresa", "EV", "Arrend. operacional", "Arrend. financeiro", "Minoritários", "EV ajustado", "Ajuste", "Balanço de"].map((c) => h("th", { scope: "col" }, c)))),
        h(
          "tbody",
          {},
          ...m.evAdj.map((r) =>
            h(
              "tr",
              {},
              h("th", { scope: "row" }, name(r.ticker)),
              h("td", { class: "num" }, fmtNum(r.evB, 0)),
              h("td", { class: "num" }, fmtNum(r.opLeaseB, 1)),
              h("td", { class: "num" }, fmtNum(r.finLeaseB, 1)),
              h("td", { class: "num" }, fmtNum(r.nciB, 1)),
              h("td", { class: "num" }, fmtNum(r.adjustedB, 0)),
              h("td", { class: "num" }, r.upliftPct === null ? "n/d" : `+${fmtNum(r.upliftPct, 1)}%`),
              h("td", {}, fmtDateFull(r.asOf)),
            ),
          ),
        ),
      ),
    ),
    h("p", { class: "sub" }, `Sem dado confirmado (n/d): ${missing.length ? missing.join(", ") : "nenhuma"}. O EV usa o market cap do dia; os arrendamentos e minoritários são do balanço da data indicada.`),
    h("ul", { class: "srcs" }, ...m.evAdj.map((r) => {
      const e = adj[r.ticker]!;
      return h("li", {}, `${name(r.ticker)}: `, safeHttpsUrl(e.source.url) ? h("a", { href: e.source.url }, e.source.label) : e.source.label);
    })),
    m.evAdjNote ? h("p", { class: "sub" }, m.evAdjNote) : null,
  );
}
