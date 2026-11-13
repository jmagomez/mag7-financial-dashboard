/** Seção do rodapé: quanto o crescimento de FCF implícito (DCF reverso) muda se o WACC de cada empresa for 1 ou 2 p.p. menor ou maior. */
import { fmtNum } from "../lib/format.ts";
import { WACC_STEPS } from "../lib/sensibilidade.ts";
import { h, type VNode } from "../lib/vdom.ts";
import type { ViewModel } from "./model.ts";

const stepLabel = (s: number): string => (s === 0 ? "WACC central" : `${s > 0 ? "+" : "−"}${fmtNum(Math.abs(s), 0)} p.p.`);

export function sensitivityBlock(m: ViewModel): VNode | null {
  if (m.sensitivity.length === 0) return null;
  const name = (t: string): string => m.names[t] ?? t;
  return h(
    "details",
    { class: "card" },
    h("summary", {}, "Sensibilidade do DCF reverso ao WACC"),
    h(
      "div",
      { class: "tw" },
      h(
        "table",
        {},
        h("caption", {}, "Crescimento de FCF implícito (% a.a. em 10 anos) conforme o WACC da empresa varia"),
        h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Empresa"), h("th", { scope: "col" }, "WACC central"), ...WACC_STEPS.map((s) => h("th", { scope: "col" }, stepLabel(s))))),
        h(
          "tbody",
          {},
          ...m.sensitivity.map((r) =>
            h(
              "tr",
              {},
              h("th", { scope: "row" }, name(r.ticker)),
              h("td", { class: "num" }, `${fmtNum(r.baseWaccPct, 2)}%`),
              ...r.cells.map((v) => h("td", { class: "num" }, v === null ? "n/s" : `${fmtNum(v, 1)}%`)),
            ),
          ),
        ),
      ),
    ),
    h("p", { class: "sub" }, "Cada coluna refaz o DCF reverso com o WACC central da empresa somado ao deslocamento do cabeçalho; EV, FCF TTM e crescimento terminal ficam fixos. A coluna central é o número do gráfico “O que está no preço”. n/s = sem significado (FCF ≤ 0, WACC ≤ crescimento terminal ou mais de 30% a.a.). Leitura do que o preço pressupõe, não projeção."),
  );
}
