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
export interface ViewModel {
  generated: string;
  marketSnapshot: string;
  names: Record<string, string>;
  companies: CompanyInput[];
  derived: Record<Ticker, DerivedResult>;
  cds: CdsRow[];
}

export function buildModel(daily: DailyFile, fund: FundamentalsFile): ViewModel {
  const companies = mergeCompanies(daily, fund);
  const names: Record<string, string> = Object.fromEntries(fund.companies.map((c) => [c.ticker, c.name ?? c.ticker]));
  const asOf = daily.meta.cdsAsOf ?? {};
  const cds: CdsRow[] = [
    ...companies.map((c) => ({ ticker: c.ticker, name: names[c.ticker] ?? c.ticker, bps: c.cds, asOf: asOf[c.ticker] ?? null, ref: false })),
    ...(daily.meta.cdsRef ?? []).map((r) => ({ ticker: r.ticker, name: r.name, bps: r.cds, asOf: asOf[r.ticker] ?? null, ref: true })),
  ];
  return {
    generated: daily.meta.generated,
    marketSnapshot: daily.meta.marketSnapshot,
    names,
    companies,
    derived: deriveAll(companies, fund.derived),
    cds,
  };
}
