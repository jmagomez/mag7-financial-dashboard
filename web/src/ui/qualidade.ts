/** Seção do rodapé: como a qualidade dos dados diários evoluiu (nível dos preços e idade dos CDS), a partir de history/snapshots.json. Só aparece se algum snapshot trouxer `quality`. */
import { fmtDateFull, fmtNum } from "../lib/format.ts";
import { CDS_STALE_AFTER_DAYS } from "../lib/freshness.ts";
import { TIER_LABEL } from "../lib/provenance.ts";
import { h, type VNode } from "../lib/vdom.ts";
import type { ViewModel } from "./model.ts";

export const QUALITY_ROWS = 10;

export function qualityBlock(m: ViewModel): VNode | null {
  const rows = (m.snapshots ?? []).flatMap((s) => (s.quality ? [{ date: s.date, q: s.quality }] : []));
  if (rows.length === 0) return null;
  const shown = rows.slice(-QUALITY_ROWS).reverse();
  const first = rows[0]?.date ?? "";
  return h(
    "details",
    { class: "card" },
    h("summary", {}, "Qualidade dos dados ao longo do tempo"),
    h(
      "div",
      { class: "tw" },
      h(
        "table",
        {},
        h("caption", {}, `Nível dos preços e idade dos CDS das Mag 7 em cada pregão (últimos ${shown.length})`),
        h("thead", {}, h("tr", {}, ...["Pregão", "Nível dos preços", "CDS com cotação", "Idade média do CDS (dias)", "Idade máxima (dias)", `Defasados (> ${CDS_STALE_AFTER_DAYS} d)`].map((c) => h("th", { scope: "col" }, c)))),
        h(
          "tbody",
          {},
          ...shown.map(({ date, q }) =>
            h(
              "tr",
              {},
              h("th", { scope: "row" }, fmtDateFull(date)),
              h("td", {}, TIER_LABEL[q.pricesTier]),
              h("td", { class: "num" }, String(q.cdsCount)),
              h("td", { class: "num" }, fmtNum(q.cdsAvgAgeDays, 1)),
              h("td", { class: "num" }, String(q.cdsMaxAgeDays)),
              h("td", { class: "num" }, q.cdsStale > 0 ? h("span", { class: "chip chip-stale" }, String(q.cdsStale)) : "0"),
            ),
          ),
        ),
      ),
    ),
    h("p", { class: "sub" }, `A série começa em ${fmtDateFull(first)}: antes disso a medida não foi gravada e não é reconstruída. Idade = dias entre a data do pregão e a data de cada cotação de CDS; só entram as 7 empresas com nível e data.`),
  );
}
