/** Seção do rodapé: WACC por empresa (CAPM) usado no DCF reverso, com todas as entradas, datas e fontes. Só aparece se fundamentals.json trouxer `derived.waccInputs` válido. */
import { safeHttpsUrl } from "../lib/escape.ts";
import { fmtDateFull, fmtNum } from "../lib/format.ts";
import { BLUME_WEIGHT, type WaccSource } from "../lib/wacc.ts";
import { h, type VNode } from "../lib/vdom.ts";
import type { ViewModel } from "./model.ts";

const link = (s: WaccSource): VNode | string => (safeHttpsUrl(s.url) ? h("a", { href: s.url }, s.label) : s.label);

export function waccBlock(m: ViewModel): VNode | null {
  const wi = m.waccInputs;
  if (!wi || m.wacc.length === 0) return null;
  const name = (t: string): string => m.names[t] ?? t;
  const pct = (v: number): string => `${fmtNum(v, 2)}%`;
  const betaDates = Object.values(wi.betas).map((b) => b.asOf).sort();
  return h(
    "details",
    { class: "card" },
    h("summary", {}, "WACC por empresa (usado no DCF reverso)"),
    h(
      "div",
      { class: "tw" },
      h(
        "table",
        {},
        h("caption", {}, "Custo médio ponderado de capital por empresa (CAPM)"),
        h("thead", {}, h("tr", {}, ...["Empresa", "Beta (5 anos)", `Beta ajustado (${fmtNum(BLUME_WEIGHT, 2)}·β + ${fmtNum(1 - BLUME_WEIGHT, 2)})`, "Capital próprio (Ke)", "Dívida (Kd, antes do imposto)", "Peso do capital próprio", "WACC"].map((c) => h("th", { scope: "col" }, c)))),
        h(
          "tbody",
          {},
          ...m.wacc.map((w) =>
            h(
              "tr",
              {},
              h("th", { scope: "row" }, name(w.ticker)),
              h("td", { class: "num" }, fmtNum(w.beta, 2)),
              h("td", { class: "num" }, fmtNum(w.betaAdj, 2)),
              h("td", { class: "num" }, pct(w.keePct)),
              h("td", { class: "num" }, pct(w.kdPct)),
              h("td", { class: "num" }, `${fmtNum(w.equityW, 1)}%`),
              h("td", { class: "num" }, pct(w.waccPct)),
            ),
          ),
        ),
      ),
    ),
    h("p", { class: "sub" }, `Juro livre ${pct(wi.rfPct)} (${fmtDateFull(wi.asOf)}), prêmio de risco ${pct(wi.erpPct)} (${fmtDateFull(wi.erpAsOf)}), alíquota ${fmtNum(wi.taxPct, 0)}%. Betas de ${fmtDateFull(betaDates[0] ?? wi.asOf)} a ${fmtDateFull(betaDates[betaDates.length - 1] ?? wi.asOf)}.`),
    h("p", { class: "sub" }, wi.note),
    h("ul", { class: "srcs" }, h("li", {}, link(wi.rfSource)), h("li", {}, link(wi.erpSource)), h("li", {}, link(wi.spreadsSource)), ...m.wacc.map((w) => (wi.betas[w.ticker] ? h("li", {}, link(wi.betas[w.ticker]!.source)) : null))),
  );
}
