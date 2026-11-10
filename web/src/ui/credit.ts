/** Peças da aba Crédito & CapEx que não são barras simples: CapEx por ano, tendência do CDS, tabela de ratings, registros e rodapé. */
import { safeHttpsUrl } from "../lib/escape.ts";
import { lastChange } from "../lib/credit.ts";
import { pd5 } from "../lib/finance.ts";
import { fmtDate, fmtDateFull, fmtNum } from "../lib/format.ts";
import { ageChip, CDS_STALE_AFTER_DAYS } from "../lib/freshness.ts";
import { h, type VNode } from "../lib/vdom.ts";
import type { LineSpec } from "./line-frame.ts";
import type { ViewModel } from "./model.ts";
import { glossaryBlock } from "./glossary.ts";
import { auditBlock, integrityBlock } from "./signals.ts";
import { TREND_NOTE, type Note } from "./notes.ts";

export function capexSpec(m: ViewModel): LineSpec {
  const series = m.companies.map((c) => ({ label: String(c.ticker), values: c.capex }));
  const last = m.capexLabels.length - 1;
  const lead = series
    .map((s) => ({ l: s.label, v: s.values[last] ?? null }))
    .filter((d): d is { l: string; v: number } => d.v !== null)
    .sort((a, b) => b.v - a.v)[0];
  return {
    id: "c-capex-year",
    title: "CapEx por ano fiscal",
    subtitle: `US$ bilhões · ${m.capexLabels[0] ?? ""} a ${m.capexLabels[last] ?? ""} · compras de imobilizado (caixa)`,
    summary: lead ? `Maior em ${m.capexLabels[last]}: ${lead.l}, ${fmtNum(lead.v, 1)} US$ bi. ${series.length} empresas, ${m.capexLabels.length} anos.` : "Sem dados válidos.",
    suffix: "",
    periods: m.capexLabels,
    series,
  };
}

/** Tendência do CDS: só snapshots com `cds`; cotações defasadas aparecem como são (a nota explica). Escala log (CRWV ≫ demais). */
export function trendSpec(m: ViewModel): LineSpec | null {
  const snaps = (m.snapshots ?? []).filter((s) => Object.keys(s.cds).length > 0);
  if (snaps.length < 2) return null;
  const tickers = m.cds.map((r) => r.ticker);
  // Só séries com algum valor: assim as cores e os tracejados seguem a ordem e não se repetem (paleta de 7).
  const series = tickers.map((t) => ({ label: t, values: snaps.map((s) => s.cds[t] ?? null) })).filter((s) => s.values.some((v) => v !== null));
  const first = snaps[0]?.date ?? "";
  const last = snaps[snaps.length - 1]?.date ?? "";
  return {
    id: "c-cds-trend",
    title: "Tendência do CDS de 5 anos",
    subtitle: `bps · escala log · ${snaps.length} snapshots (${fmtDateFull(first)} a ${fmtDateFull(last)}) · tracejado = referências fora das Mag 7`,
    summary: `${series.length} séries em ${snaps.length} snapshots diários. Escala logarítmica: a mesma distância vertical é a mesma variação percentual.`,
    suffix: "",
    scale: "log",
    digits: 0,
    periods: snaps.map((s) => fmtDate(s.date)),
    series,
  };
}

export function trendNotes(m: ViewModel): Note[] {
  const snaps = (m.snapshots ?? []).filter((s) => Object.keys(s.cds).length > 0);
  const ch = lastChange(snaps, m.cds.map((r) => r.ticker));
  const out: Note[] = [TREND_NOTE];
  if (ch && ch.moves.length) out.push([`Última variação (${fmtDateFull(ch.from)} → ${fmtDateFull(ch.to)}): ${ch.moves.join(" · ")}.`]);
  return out;
}

export function trendBlock(m: ViewModel): { spec: LineSpec | null; message: string | null } {
  if (m.snapshots === null) return { spec: null, message: "Tendência indisponível: não foi possível carregar history/snapshots.json. O restante do painel não depende dele." };
  const spec = trendSpec(m);
  return spec ? { spec, message: null } : { spec: null, message: "Aguardando acúmulo de snapshots (a rotina diária grava um por dia útil em history/snapshots.json)." };
}

export function ratingsTable(m: ViewModel): VNode {
  return h(
    "section",
    { class: "card", "aria-labelledby": "rat-title" },
    h("h2", { id: "rat-title" }, "Ratings e CDS"),
    h(
      "div",
      { class: "tw" },
      h(
        "table",
        {},
        h("caption", {}, "Ratings de crédito, CDS de 5 anos, idade da cotação e PD implícita"),
        h(
          "thead",
          {},
          h("tr", {}, ...["Empresa", "S&P", "Moody’s", "CDS 5a (bps)", "Cotação", "PD 5a impl."].map((c) => h("th", { scope: "col" }, c))),
        ),
        h(
          "tbody",
          {},
          ...m.cds.map((r) => {
            const chip = r.bps === null ? null : ageChip(r.asOf, m.generated, CDS_STALE_AFTER_DAYS);
            const p = pd5(r.bps);
            return h(
              "tr",
              { class: chip?.level === "stale" ? "dim" : undefined },
              h("th", { scope: "row" }, r.name, r.ref ? h("span", { class: "muted" }, " ref.") : null),
              h("td", {}, r.rating?.sp ?? "n/d"),
              h("td", {}, r.rating?.moody ?? "n/d"),
              h("td", { class: "num" }, fmtNum(r.bps, 0)),
              h("td", {}, chip ? h("span", { class: `chip chip-${chip.level}` }, chip.text) : "n/d"),
              h("td", { class: "num" }, p === null ? "n/d" : `~${fmtNum(p, 1)}%`),
            );
          }),
        ),
      ),
    ),
  );
}

export function cdsLogBlock(m: ViewModel): VNode {
  const items = m.cdsLog.slice().reverse();
  return h(
    "details",
    { class: "card" },
    h("summary", {}, "Histórico de verificações de CDS"),
    h("ul", { class: "notes" }, ...(items.length ? items.map((x) => h("li", {}, h("b", {}, fmtDateFull(x.date)), ` — ${x.text}`)) : [h("li", {}, "Sem registros.")])),
  );
}

/** Rodapé global: notas metodológicas e fontes. Fonte só vira link se a URL for https; senão aparece só o rótulo. */
export function footerBlock(m: ViewModel): VNode {
  return h(
    "footer",
    {},
    m.methodNotes.length
      ? h("details", { class: "card" }, h("summary", {}, "Notas metodológicas"), h("ul", { class: "notes" }, ...m.methodNotes.map((n) => h("li", {}, n))))
      : null,
    m.sources.length
      ? h(
          "details",
          { class: "card" },
          h("summary", {}, `Fontes (${m.sources.length})`),
          h("ul", { class: "srcs" }, ...m.sources.map((s) => h("li", {}, safeHttpsUrl(s.url) ? h("a", { href: s.url }, s.label) : s.label))),
        )
      : null,
    glossaryBlock(m),
    integrityBlock(m),
    auditBlock(m),
    h("p", {}, "Informativo, sem recomendação de investimento. Dados de fontes públicas; veja as datas em cada indicador."),
  );
}
