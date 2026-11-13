/** Seção do rodapé: data, nível e fonte de cada número de entrada trimestral. Só aparece se algum bloco de `derived` já estiver no formato v2. */
import { safeHttpsUrl } from "../lib/escape.ts";
import { fmtDateFull } from "../lib/format.ts";
import { TIER_LABEL } from "../lib/provenance.ts";
import { h, type VNode } from "../lib/vdom.ts";
import type { ViewModel } from "./model.ts";

export function datasBlock(m: ViewModel): VNode | null {
  const rows = m.derivedDates ?? [];
  if (rows.length === 0) return null;
  const name = (t: string): string => m.names?.[t] ?? t;
  return h(
    "details",
    { class: "card" },
    h("summary", {}, "Datas e fontes dos dados trimestrais"),
    h(
      "div",
      { class: "tw" },
      h(
        "table",
        {},
        h("caption", {}, "Data, nível e fonte de cada número de entrada, por empresa"),
        h("thead", {}, h("tr", {}, ...["Dado", "Empresa", "Data", "Nível", "Fonte"].map((c) => h("th", { scope: "col" }, c)))),
        h(
          "tbody",
          {},
          ...rows.map((r) =>
            h(
              "tr",
              {},
              h("th", { scope: "row" }, r.what),
              h("td", {}, name(r.ticker)),
              h("td", {}, fmtDateFull(r.asOf)),
              h("td", {}, TIER_LABEL[r.tier]),
              h("td", {}, safeHttpsUrl(r.source.url) ? h("a", { href: r.source.url }, r.source.label) : r.source.label),
            ),
          ),
        ),
      ),
    ),
    h("p", { class: "sub" }, "Data = fim do período a que o número se refere (ou do snapshot de preços, no EBITDA implícito). Nível: primária = emissor, bolsa ou SEC; derivada = calculada ou estimada a partir de outros valores. Sem a linha de uma empresa, o dado não foi confirmado."),
  );
}
