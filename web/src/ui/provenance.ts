/** Seção do rodapé: de onde vem, de quando é e de que nível é cada grupo de números diários. Só aparece se data.json trouxer `meta.provenance`. */
import { ageDays } from "../lib/freshness.ts";
import { fmtDateFull } from "../lib/format.ts";
import { ANCHOR_MAX_DAYS, TIER_LABEL, type ProvEntry } from "../lib/provenance.ts";
import { h, type VNode } from "../lib/vdom.ts";
import type { ViewModel } from "./model.ts";

export function provenanceBlock(m: ViewModel): VNode | null {
  const p = m.provenance;
  if (!p) return null;
  const nameOf = (t: string): string => m.names[t] ?? m.cds.find((r) => r.ticker === t)?.name ?? t;
  const rows: [string, ProvEntry, string][] = [
    ["Preços", p.prices, p.prices.source ?? "n/d"],
    ["Market cap", p.marketCapB, p.marketCapB.method ?? "n/d"],
    ["Pesos", p.weight, p.weight.method ?? "n/d"],
    ...(Object.entries(p.cds) as [string, ProvEntry][])
      .sort(([a], [b]) => nameOf(a).localeCompare(nameOf(b), "pt-BR"))
      .map(([t, e]): [string, ProvEntry, string] => [`CDS ${nameOf(t)}`, e, e.source ?? "cotação"]),
  ];
  const anchor = p.marketCapB.anchor;
  const age = anchor ? ageDays(anchor.date, m.generated) : null;
  const old = age !== null && age > ANCHOR_MAX_DAYS;
  return h(
    "details",
    { class: "card" },
    h("summary", {}, "Proveniência dos números (nível, data e fonte)"),
    h(
      "div",
      { class: "tw" },
      h(
        "table",
        {},
        h("caption", {}, "Nível, data e fonte ou método de cada grupo de números diários"),
        h("thead", {}, h("tr", {}, ...["Número", "Nível", "Data", "Fonte ou método"].map((c) => h("th", { scope: "col" }, c)))),
        h("tbody", {}, ...rows.map(([label, e, how]) => h("tr", {}, h("th", { scope: "row" }, label), h("td", {}, TIER_LABEL[e.tier]), h("td", {}, fmtDateFull(e.asOf)), h("td", {}, how)))),
      ),
    ),
    anchor && age !== null
      ? h(
          "p",
          {},
          `O market cap diário é o preço do dia × ações implícitas ancoradas em ${fmtDateFull(anchor.date)} (${anchor.source}), há ${age} d. `,
          old ? h("span", { class: "chip chip-stale" }, `defasada · reancorar (limite de ${ANCHOR_MAX_DAYS} d)`) : h("span", { class: "chip chip-fresh" }, `atual · dentro do limite de ${ANCHOR_MAX_DAYS} d`),
        )
      : h("p", {}, "Sem âncora das ações implícitas informada: a idade do market cap não pode ser avaliada."),
  );
}
