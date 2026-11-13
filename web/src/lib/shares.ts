/**
 * Ações em circulação reportadas (`derived.sharesOut` de fundamentals.json: capa do último 10-Q/10-K, em milhões).
 * Servem só para CONFERIR as ações implícitas do market cap diário (market cap ÷ preço); nenhum número exibido muda.
 * Opcional: bloco ausente ou malformado → null e o painel segue sem a seção.
 */
export const SHARES_DIVERGENCE_WARN = 2; // % de diferença entre ações implícitas e reportadas; decisão de design.

export interface SharesEntry {
  asOf: string;
  total: number;
  classes?: Record<string, number>;
  form: string;
  precision?: string;
  source: { label: string; url: string };
}
export type SharesOut = Record<string, SharesEntry>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const pos = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x > 0;

export function parseSharesOut(raw: unknown): SharesOut | null {
  if (!isObj(raw)) return null;
  const out: SharesOut = {};
  for (const [t, v] of Object.entries(raw)) {
    if (!isObj(v) || typeof v.asOf !== "string" || !ISO.test(v.asOf) || !pos(v.total) || typeof v.form !== "string") return null;
    const s = v.source;
    if (!isObj(s) || typeof s.label !== "string" || typeof s.url !== "string") return null;
    const e: SharesEntry = { asOf: v.asOf, total: v.total, form: v.form, source: { label: s.label, url: s.url } };
    if (typeof v.precision === "string") e.precision = v.precision;
    if (v.classes !== undefined) {
      if (!isObj(v.classes)) return null;
      const cl: Record<string, number> = {};
      for (const [k, n] of Object.entries(v.classes)) {
        if (!pos(n)) return null;
        cl[k] = n;
      }
      // classes têm de somar o total (tolerância de 0,1%: a capa arredonda); senão o bloco inteiro é descartado.
      const sum = Object.values(cl).reduce((a, b) => a + b, 0);
      if (Math.abs(sum / v.total - 1) > 0.001) return null;
      e.classes = cl;
    }
    out[t] = e;
  }
  return Object.keys(out).length ? out : null;
}

export interface SharesRow {
  ticker: string;
  reported: number;
  implied: number;
  /** (implícitas ÷ reportadas − 1) em %. */
  diffPct: number;
  warn: boolean;
}

/** Ações implícitas = market cap (US$ bi) ÷ preço × 1000, em milhões. */
export function reconcileShares(companies: { ticker: string; price: number; marketCapB: number }[], sh: SharesOut): SharesRow[] {
  const rows: SharesRow[] = [];
  for (const c of companies) {
    const e = sh[c.ticker];
    if (!e || !(c.price > 0) || !(c.marketCapB > 0)) continue;
    const implied = (c.marketCapB / c.price) * 1000;
    const diffPct = (implied / e.total - 1) * 100;
    rows.push({ ticker: c.ticker, reported: e.total, implied, diffPct, warn: Math.abs(diffPct) > SHARES_DIVERGENCE_WARN });
  }
  return rows;
}
