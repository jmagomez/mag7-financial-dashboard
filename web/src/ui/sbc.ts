/** Seção do rodapé: FCF após remuneração em ações (SBC). Só aparece se fundamentals.json trouxer `derived.sbcTTM` válido para alguma empresa. */
import { safeHttpsUrl } from "../lib/escape.ts";
import { fmtDateFull, fmtNum } from "../lib/format.ts";
import { h, type VNode } from "../lib/vdom.ts";
import type { ViewModel } from "./model.ts";

export function sbcBlock(m: ViewModel): VNode | null {
  if (m.sbc.length === 0 || !m.sbcTtm) return null;
  const name = (t: string): string => m.names[t] ?? t;
  const sbc = m.sbcTtm;
  const missing = m.companies.map((c) => String(c.ticker)).filter((t) => !m.sbc.some((r) => r.ticker === t));
  return h(
    "details",
    { class: "card" },
    h("summary", {}, "FCF após remuneração em ações (SBC)"),
    h(
      "div",
      { class: "tw" },
      h(
        "table",
        {},
        h("caption", {}, "FCF TTM, SBC TTM e FCF após SBC por empresa (US$ bi)"),
        h("thead", {}, h("tr", {}, ...["Empresa", "FCF TTM", "SBC TTM", "FCF após SBC", "SBC ÷ FCF", "Yield após SBC", "SBC até"].map((c) => h("th", { scope: "col" }, c)))),
        h(
          "tbody",
          {},
          ...m.sbc.map((r) =>
            h(
              "tr",
              {},
              h("th", { scope: "row" }, name(r.ticker)),
              h("td", { class: "num" }, fmtNum(r.fcfB, 1)),
              h("td", { class: "num" }, fmtNum(r.sbcB, 1)),
              h("td", { class: "num" }, fmtNum(r.afterB, 1)),
              h("td", { class: "num" }, r.sbcOfFcfPct === null ? "n/s" : `${fmtNum(r.sbcOfFcfPct, 1)}%`),
              h("td", { class: "num" }, r.yieldAfterPct === null ? "n/d" : `${fmtNum(r.yieldAfterPct, 1)}%`),
              h("td", {}, fmtDateFull(r.asOf)),
            ),
          ),
        ),
      ),
    ),
    h("p", { class: "sub" }, `SBC = remuneração em ações da demonstração do fluxo de caixa, nos mesmos 12 meses do FCF TTM. FCF após SBC = FCF TTM − SBC TTM; n/s = FCF ≤ 0, razão sem sentido.${missing.length ? ` Sem dado: ${missing.join(", ")}.` : ""}`),
    h("ul", { class: "srcs" }, ...m.sbc.map((r) => {
      const e = sbc[r.ticker]!;
      return h("li", {}, `${name(r.ticker)}: ${e.parts}. `, safeHttpsUrl(e.source.url) ? h("a", { href: e.source.url }, e.source.label) : e.source.label);
    })),
    m.sbcNote ? h("p", { class: "sub" }, m.sbcNote) : null,
  );
}
