/** Tipos do contrato de dados (espelham schemas/*.schema.json). Valores em US$ bilhões salvo indicação. */

export type Ticker = "AAPL" | "MSFT" | "NVDA" | "GOOGL" | "AMZN" | "META" | "TSLA";

export interface DcfAssumptions {
  waccPct?: number;
  terminalGrowthPct?: number;
  years?: number;
}

export interface Balance {
  cash: number;
  debt: number;
}

/** Bloco `derived` de fundamentals.json: ENTRADAS dos cálculos (nunca múltiplos congelados). */
export interface Derived {
  balanceQ2_2026: Partial<Record<Ticker, Balance>>;
  fcfTTM: Partial<Record<Ticker, number>>;
  fwdPE: Partial<Record<Ticker, number>>;
  ebitdaImplB: Partial<Record<Ticker, number>>;
  fwdEPS: Partial<Record<Ticker, number>>;
  oneOffTTM: Partial<Record<Ticker, number>>;
  dcfAssumptions?: DcfAssumptions;
  /** Receita trimestral dos segmentos de nuvem/IA (US$ bi) e crescimento a/a (%). */
  cloudSegmentsQ2_2026?: { n: string; v: number; g: number }[];
}

/** Campos de uma empresa já mescladas (data.json + fundamentals.json) usados pelos cálculos. */
export interface CompanyInput {
  ticker: Ticker;
  price: number;
  marketCapB: number;
  cds: number | null;
  /** Últimos 10 trimestres, do mais antigo ao mais recente. */
  revHistory: number[];
  niHistory: number[];
  fcfAnnual: number[];
  capex: number[];
  valuation: { fcfYield?: number; fcfB?: number };
}

export interface Valuation {
  pe: number | null;
  peCore: number | null;
  peFwd: number | null;
  ev: number | null;
  evSales: number | null;
  evEbitda: number | null;
  net: number | null;
  netPct: number | null;
  impliedG: number | null;
  fcfYield: number | null;
  fcfB: number | null;
}

export interface DerivedResult {
  ticker: Ticker;
  valuation: Valuation;
  capexOcf: number | null;
  pd5: number | null;
}
