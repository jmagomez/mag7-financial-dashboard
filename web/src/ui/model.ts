/** Modelo de visão: junta os dois JSON, calcula os derivados (núcleo da Fase 1) e resolve nomes e datas. */
import { deriveAll } from "../lib/finance.ts";
import { mergeCompanies, type DailyFile, type FundamentalsFile } from "../lib/merge.ts";
import type { CompanyInput, DerivedResult, Ticker } from "../types.ts";

export interface CdsRow {
  ticker: string;
  name: string;
  bps: number | null;
  asOf: string | null;
  ref: boolean; // referência fora das Mag 7 (ORCL, CRWV)
}
export interface Brief {
  headline: string;
  bullets: string[];
  sources: { label: string; url: string }[];
  date: string;
}
export interface ViewModel {
  generated: string;
  marketSnapshot: string;
  names: Record<string, string>;
  companies: CompanyInput[];
  derived: Record<Ticker, DerivedResult>;
  cds: CdsRow[];
  /** Rótulos dos trimestres (receita, lucro, margem) e dos anos fiscais (FCF). */
  periods: string[];
  fcfPeriods: string[];
  brief: Brief | null;
}

function labelsFor(given: string[] | undefined, n: number): string[] {
  return given && given.length > 0 ? given : Array.from({ length: n }, (_, i) => `#${i + 1}`);
}

export function buildModel(daily: DailyFile, fund: FundamentalsFile): ViewModel {
  const companies = mergeCompanies(daily, fund);
  const names: Record<string, string> = Object.fromEntries(fund.companies.map((c) => [c.ticker, c.name ?? c.ticker]));
  const asOf = daily.meta.cdsAsOf ?? {};
  const cds: CdsRow[] = [
    ...companies.map((c) => ({ ticker: c.ticker, name: names[c.ticker] ?? c.ticker, bps: c.cds, asOf: asOf[c.ticker] ?? null, ref: false })),
    ...(daily.meta.cdsRef ?? []).map((r) => ({ ticker: r.ticker, name: r.name, bps: r.cds, asOf: asOf[r.ticker] ?? null, ref: true })),
  ];
  const first = companies[0];
  const periods = labelsFor(fund.meta?.historyLabels, first?.revHistory.length ?? 0);
  const fcfPeriods = labelsFor(fund.meta?.fcfLabels, first?.fcfAnnual.length ?? 0);
  // Falha alto: série de tamanho diferente dos rótulos deslocaria colunas sem aviso.
  for (const c of companies) {
    for (const [what, len, want] of [
      ["receita", c.revHistory.length, periods.length],
      ["lucro líquido", c.niHistory.length, periods.length],
      ["FCF anual", c.fcfAnnual.length, fcfPeriods.length],
    ] as const) {
      if (len !== want) throw new Error(`${c.ticker}: ${what} tem ${len} pontos, os rótulos têm ${want}`);
    }
  }
  const b = daily.meta.dailyBrief;
  return {
    generated: daily.meta.generated,
    marketSnapshot: daily.meta.marketSnapshot,
    names,
    companies,
    derived: deriveAll(companies, fund.derived),
    cds,
    periods,
    fcfPeriods,
    brief: b ? { headline: b.headline, bullets: b.bullets ?? [], sources: b.sources ?? [], date: b.date } : null,
  };
}
