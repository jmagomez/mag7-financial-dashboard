/**
 * WACC por empresa (CAPM) a partir de `derived.waccInputs` (fundamentals.json): entradas com fonte e data, nenhuma embutida no código.
 *   Ke = Rf + β ajustado × ERP, com β ajustado = 0,67·β + 0,33 (Blume);  Kd = Rf + spread do rating S&P;
 *   WACC = E/(D+E)·Ke + D/(D+E)·Kd·(1 − t),  E = market cap do dia, D = dívida financiada do balanço (sem arrendamentos).
 * Sem entrada válida para uma empresa, o resultado é null e o DCF reverso usa o WACC único de `dcfAssumptions`.
 */
export const BLUME_WEIGHT = 0.67; // peso do beta medido; o restante puxa para 1 (decisão de método, prática de mercado)

export interface WaccSource {
  label: string;
  url: string;
}
export interface BetaEntry {
  beta: number;
  asOf: string;
  source: WaccSource;
}
export interface WaccInputs {
  asOf: string;
  rfPct: number;
  rfSource: WaccSource;
  erpPct: number;
  erpAsOf: string;
  erpSource: WaccSource;
  taxPct: number;
  ratingSpreadsPct: Record<string, number>;
  spreadsSource: WaccSource;
  betas: Record<string, BetaEntry>;
  note: string;
}
export interface WaccRow {
  ticker: string;
  beta: number;
  betaAdj: number;
  keePct: number;
  spreadPct: number;
  kdPct: number;
  equityW: number;
  waccPct: number;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, lo: number, hi: number): x is number => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;
const src = (x: unknown): WaccSource | null => (isObj(x) && typeof x.label === "string" && typeof x.url === "string" ? { label: x.label, url: x.url } : null);
const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Bloco ausente ou malformado → null (o painel segue com o WACC único). Faixas de sanidade evitam erro de digitação. */
export function parseWaccInputs(raw: unknown): WaccInputs | null {
  if (!isObj(raw)) return null;
  const rfS = src(raw.rfSource);
  const erpS = src(raw.erpSource);
  const spS = src(raw.spreadsSource);
  if (!rfS || !erpS || !spS) return null;
  if (typeof raw.asOf !== "string" || !ISO.test(raw.asOf) || typeof raw.erpAsOf !== "string" || !ISO.test(raw.erpAsOf)) return null;
  if (!num(raw.rfPct, 0, 20) || !num(raw.erpPct, 0, 15) || !num(raw.taxPct, 0, 50) || typeof raw.note !== "string") return null;
  if (!isObj(raw.ratingSpreadsPct) || !isObj(raw.betas)) return null;
  const spreads: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw.ratingSpreadsPct)) {
    if (!num(v, 0, 30)) return null;
    spreads[k] = v;
  }
  const betas: Record<string, BetaEntry> = {};
  for (const [t, b] of Object.entries(raw.betas)) {
    if (!isObj(b) || !num(b.beta, 0.01, 5) || typeof b.asOf !== "string" || !ISO.test(b.asOf)) return null;
    const s = src(b.source);
    if (!s) return null;
    betas[t] = { beta: b.beta, asOf: b.asOf, source: s };
  }
  if (Object.keys(spreads).length === 0 || Object.keys(betas).length === 0) return null;
  return { asOf: raw.asOf, rfPct: raw.rfPct, rfSource: rfS, erpPct: raw.erpPct, erpAsOf: raw.erpAsOf, erpSource: erpS, taxPct: raw.taxPct, ratingSpreadsPct: spreads, spreadsSource: spS, betas, note: raw.note };
}

/** Spread do rating: exato ("A+") ou sem o sinal ("AA+" e "AA−" → "AA"); sem correspondência, null. */
export function spreadFor(sp: string | undefined, table: Record<string, number>): number | null {
  if (!sp) return null;
  const norm = sp.replace("−", "-").trim();
  const exact = table[norm];
  if (exact !== undefined) return exact;
  const base = table[norm.replace(/[+-]$/, "")];
  return base !== undefined ? base : null;
}

export function computeWacc(ticker: string, marketCapB: number, debtB: number, sp: string | undefined, wi: WaccInputs): WaccRow | null {
  const b = wi.betas[ticker];
  const spread = spreadFor(sp, wi.ratingSpreadsPct);
  if (!b || spread === null || !(marketCapB > 0) || !(debtB >= 0)) return null;
  const betaAdj = BLUME_WEIGHT * b.beta + (1 - BLUME_WEIGHT);
  const ke = wi.rfPct + betaAdj * wi.erpPct;
  const kd = wi.rfPct + spread;
  const eW = marketCapB / (marketCapB + debtB);
  const wacc = eW * ke + (1 - eW) * kd * (1 - wi.taxPct / 100);
  return { ticker, beta: b.beta, betaAdj: round2(betaAdj), keePct: round2(ke), spreadPct: spread, kdPct: round2(kd), equityW: round2(eW * 100), waccPct: round2(wacc) };
}
