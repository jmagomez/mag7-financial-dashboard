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
interface Period {
  period?: string;
  revenueB?: number;
  revGrowth?: number;
  netIncomeB?: number;
  operatingIncomeB?: number;
  netMargin?: number;
  epsDiluted?: number;
  epsNonGaap?: number;
  note?: string;
}
interface FundCompany {
  ticker: Ticker;
  name?: string;
  color?: string;
  rating?: { sp: string; moody: string };
  annual?: Period;
  quarter?: Period;
  revHistory: number[];
  niHistory: number[];
  fcfAnnual: number[];
  capex: number[];
  valuation: { fcfYield?: number; fcfB?: number };
}
export interface DailyFile {
  meta: {
    generated: string;
    marketSnapshot: string;
    totalMarketCapT: number;
    /** Data de cada nível de CDS (inclui as referências ORCL/CRWV). */
    cdsAsOf?: Record<string, string>;
    cdsRef?: { ticker: string; name: string; cds: number | null; rating?: { sp: string; moody: string } }[];
    cdsLog?: { date: string; text: string }[];
    audit?: { sev: "alta" | "média" | "baixa"; area: string; finding: string; action: string }[];
    catalysts?: { ticker: string; date: string; event: string; confirmed?: boolean; done?: boolean }[];
    dailyBrief?: { headline: string; bullets: string[]; sources: { label: string; url: string }[]; date: string };
  };
  companies: DailyCompany[];
}
export interface FundamentalsFile {
  meta?: { historyLabels?: string[]; fcfLabels?: string[]; capexLabels?: string[]; annualLabel?: string; quarterLabel?: string; notes?: string[]; creditNotes?: string[] };
  sources?: { label: string; url: string }[];
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
