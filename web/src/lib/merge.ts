/**
 * Junta data.json (diário) + fundamentals.json (trimestral/estático) no formato único usado pelo
 * dashboard e pelos cálculos. Espelha src/common.py::merge() e mergeData() do index.html.
 * Só recusa o que quebraria silenciosamente (ticker sem par); não "conserta" dados.
 */
import type { CompanyInput, Derived, Ticker } from "../types.ts";

interface DailyCompany {
  ticker: Ticker;
  price: number;
  marketCapB: number;
  weight: number;
  cds: number | null;
}
interface FundCompany {
  ticker: Ticker;
  revHistory: number[];
  niHistory: number[];
  fcfAnnual: number[];
  capex: number[];
  valuation: { fcfYield?: number; fcfB?: number };
}
export interface DailyFile {
  meta: { generated: string; marketSnapshot: string; totalMarketCapT: number };
  companies: DailyCompany[];
}
export interface FundamentalsFile {
  companies: FundCompany[];
  derived: Derived;
}

export function mergeCompanies(daily: DailyFile, fund: FundamentalsFile): CompanyInput[] {
  const byTicker = new Map(daily.companies.map((c) => [c.ticker, c]));
  return fund.companies.map((f) => {
    const d = byTicker.get(f.ticker);
    if (!d) throw new Error(`data.json sem a empresa ${f.ticker}`);
    return {
      ticker: f.ticker,
      price: d.price,
      marketCapB: d.marketCapB,
      cds: d.cds ?? null,
      revHistory: f.revHistory,
      niHistory: f.niHistory,
      fcfAnnual: f.fcfAnnual,
      capex: f.capex,
      valuation: f.valuation,
    };
  });
}
