/** Modelo de visão: junta os dois JSON, calcula os derivados (núcleo da Fase 1) e resolve nomes e datas. */
import { deriveAll } from "../lib/finance.ts";
import { capexIntensity, parseSnapshots, type Snapshot } from "../lib/credit.ts";
import { type IndRow } from "../lib/indicators.ts";
import { type AuditInput, type Finding } from "../lib/signals.ts";
import { parseGlossary, type Glossary } from "../lib/glossary.ts";
import { parseProvenance, type Provenance } from "../lib/provenance.ts";
import { parseSharesOut, type SharesOut } from "../lib/shares.ts";
import { mergeCompanies, type DailyFile, type FundamentalsFile } from "../lib/merge.ts";
import type { CompanyInput, DerivedResult, Ticker } from "../types.ts";

export interface CdsRow {
  ticker: string;
  name: string;
  bps: number | null;
  asOf: string | null;
  ref: boolean; // referência fora das Mag 7 (ORCL, CRWV)
  rating: { sp: string; moody: string } | null;
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
  /** Siglas e definições (`glossary.json`); vazio se o arquivo falhar (o painel segue sem dicas). */
  glossary: Glossary;
  brief: Brief | null;
  /** null = data.json sem `meta.provenance` (ou malformada): a seção do rodapé some. */
  provenance: Provenance | null;
  /** null = fundamentals.json sem `derived.sharesOut` (ou malformado): a seção do rodapé some. */
  sharesOut: SharesOut | null;
  capexLabels: string[];
  /** CapEx ÷ receita do último ano (%), por ticker; null sem receita válida. */
  capexIntensity: Record<string, number | null>;
  creditNotes: string[];
  methodNotes: string[];
  sources: { label: string; url: string }[];
  cdsLog: { date: string; text: string }[];
  /** null = snapshots indisponíveis (a tendência mostra aviso; o resto do painel segue). */
  snapshots: Snapshot[] | null;
  audit: AuditInput;
  findings: Finding[];
  /** Linhas da aba Indicadores (dados do ano fiscal e do trimestre de cada empresa). */
  rows: IndRow[];
  annualLabel: string;
  quarterLabel: string;
  /** Campos da tabela de valuation que vêm direto da fonte (não são calculados). */
  valuationExtras: Record<string, { divYield: number | null; grossMargin: number | null }>;
  /** Balanço do 2T 2026 (caixa + títulos e dívida financiada), US$ bi. */
  balance: Record<string, { cash: number; debt: number } | undefined>;
  /** Segmentos de nuvem/IA do trimestre (vazio se a fonte não traz). */
  cloudSegments: { n: string; v: number; g: number }[];
}

function labelsFor(given: string[] | undefined, n: number): string[] {
  return given && given.length > 0 ? given : Array.from({ length: n }, (_, i) => `#${i + 1}`);
}

export function buildModel(daily: DailyFile, fund: FundamentalsFile, snapshotsRaw?: unknown, glossaryRaw?: unknown): ViewModel {
  const companies = mergeCompanies(daily, fund);
  const names: Record<string, string> = Object.fromEntries(fund.companies.map((c) => [c.ticker, c.name ?? c.ticker]));
  const asOf = daily.meta.cdsAsOf ?? {};
  const ratings = Object.fromEntries(fund.companies.map((c) => [c.ticker, c.rating ?? null]));
  const cds: CdsRow[] = [
    ...companies.map((c) => ({ ticker: c.ticker, name: names[c.ticker] ?? c.ticker, bps: c.cds, asOf: asOf[c.ticker] ?? null, ref: false, rating: ratings[c.ticker] ?? null })),
    ...(daily.meta.cdsRef ?? []).map((r) => ({ ticker: r.ticker, name: r.name, bps: r.cds, asOf: asOf[r.ticker] ?? null, ref: true, rating: r.rating ?? null })),
  ];
  const first = companies[0];
  const periods = labelsFor(fund.meta?.historyLabels, first?.revHistory.length ?? 0);
  const fcfPeriods = labelsFor(fund.meta?.fcfLabels, first?.fcfAnnual.length ?? 0);
  const capexLabels = labelsFor(fund.meta?.capexLabels, first?.capex.length ?? 0);
  // Falha alto: série de tamanho diferente dos rótulos deslocaria colunas sem aviso.
  for (const c of companies) {
    for (const [what, len, want] of [
      ["receita", c.revHistory.length, periods.length],
      ["lucro líquido", c.niHistory.length, periods.length],
      ["FCF anual", c.fcfAnnual.length, fcfPeriods.length],
      ["CapEx", c.capex.length, capexLabels.length],
    ] as const) {
      if (len !== want) throw new Error(`${c.ticker}: ${what} tem ${len} pontos, os rótulos têm ${want}`);
    }
  }
  const derived = deriveAll(companies, fund.derived);
  const dailyByTicker = new Map(daily.companies.map((c) => [c.ticker, c]));
  const snaps = snapshotsRaw === undefined || snapshotsRaw === null ? null : parseSnapshots(snapshotsRaw);
  const audit: AuditInput = {
    generated: daily.meta.generated,
    marketSnapshot: daily.meta.marketSnapshot,
    totalMarketCapT: daily.meta.totalMarketCapT,
    companies: fund.companies.map((f) => {
      const d = dailyByTicker.get(f.ticker);
      const r = derived[f.ticker];
      return {
        ticker: f.ticker,
        marketCapB: d?.marketCapB ?? 0,
        weight: d?.weight ?? 0,
        cds: d?.cds ?? null,
        pd5: r?.pd5 ?? null,
        annual: f.annual,
        quarter: f.quarter,
        netCashB: r?.valuation.net ?? null,
        capexOcf: r?.capexOcf ?? null,
        fcfRecalc: fund.derived.fcfTTM[f.ticker] !== undefined,
        fcfYield: r?.valuation.fcfYield ?? null,
        fcfYieldSrc: f.valuation.fcfYield ?? null,
      };
    }),
    catalysts: daily.meta.catalysts ?? [],
    cdsAsOf: asOf,
    snapshotCount: snaps === null ? null : snaps.length,
    snapshotLast: snaps && snaps.length ? (snaps[snaps.length - 1] as Snapshot).date : null,
  };
  const b = daily.meta.dailyBrief;
  return {
    generated: daily.meta.generated,
    marketSnapshot: daily.meta.marketSnapshot,
    names,
    companies,
    derived,
    cds,
    periods,
    fcfPeriods,
    capexLabels,
    capexIntensity: Object.fromEntries(fund.companies.map((c) => [c.ticker, capexIntensity(c.capex, c.annual?.revenueB)])),
    creditNotes: fund.meta?.creditNotes ?? [],
    methodNotes: fund.meta?.notes ?? [],
    sources: fund.sources ?? [],
    cdsLog: daily.meta.cdsLog ?? [],
    snapshots: snaps,
    audit,
    findings: daily.meta.audit ?? [],
    rows: fund.companies.map((f) => ({
      ticker: f.ticker,
      name: f.name ?? f.ticker,
      color: f.color ?? null,
      price: dailyByTicker.get(f.ticker)?.price ?? 0,
      marketCapB: dailyByTicker.get(f.ticker)?.marketCapB ?? 0,
      annual: f.annual ?? {},
      quarter: f.quarter ?? {},
    })),
    valuationExtras: Object.fromEntries(fund.companies.map((f) => [f.ticker, { divYield: f.valuation.divYield ?? null, grossMargin: f.valuation.grossMargin ?? null }])),
    balance: fund.derived.balanceQ2_2026,
    cloudSegments: (fund.derived.cloudSegmentsQ2_2026 ?? []).map((s) => ({ n: s.n, v: s.v, g: s.g })),
    annualLabel: fund.meta?.annualLabel ?? "ano fiscal",
    quarterLabel: fund.meta?.quarterLabel ?? "trimestre",
    glossary: parseGlossary(glossaryRaw),
    provenance: parseProvenance(daily.meta.provenance),
    sharesOut: parseSharesOut((fund.derived as { sharesOut?: unknown }).sharesOut),
    brief: b ? { headline: b.headline, bullets: b.bullets ?? [], sources: b.sources ?? [], date: b.date } : null,
  };
}
