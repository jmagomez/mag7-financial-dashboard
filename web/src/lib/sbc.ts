/**
 * FCF após remuneração em ações (SBC): `derived.sbcTTM` de fundamentals.json (SBC dos últimos 12 meses, US$ bi, com fonte e data)
 * contra o FCF TTM auditado (`derived.fcfTTM`). Opcional: bloco ausente ou sem nenhuma entrada válida → null e a seção some;
 * uma empresa malformada fica de fora (n/d), as outras seguem.
 */
export interface SbcEntry {
  valueB: number;
  asOf: string;
  parts: string;
  source: { label: string; url: string };
}
export type SbcTtm = Record<string, SbcEntry>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

export function parseSbc(raw: unknown): SbcTtm | null {
  if (!isObj(raw)) return null;
  const out: SbcTtm = {};
  for (const [t, v] of Object.entries(raw)) {
    if (!isObj(v) || typeof v.valueB !== "number" || !Number.isFinite(v.valueB) || v.valueB <= 0 || v.valueB > 500) continue;
    if (typeof v.asOf !== "string" || !ISO.test(v.asOf) || typeof v.parts !== "string") continue;
    const s = v.source;
    if (!isObj(s) || typeof s.label !== "string" || typeof s.url !== "string") continue;
    out[t] = { valueB: v.valueB, asOf: v.asOf, parts: v.parts, source: { label: s.label, url: s.url } };
  }
  return Object.keys(out).length > 0 ? out : null;
}

export interface SbcRow {
  ticker: string;
  fcfB: number;
  sbcB: number;
  /** FCF − SBC (US$ bi). */
  afterB: number;
  /** SBC ÷ FCF (%), 1 casa; null se o FCF ≤ 0 (a razão não faz sentido). */
  sbcOfFcfPct: number | null;
  /** (FCF − SBC) ÷ market cap (%), 1 casa. */
  yieldAfterPct: number | null;
  asOf: string;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

/** Empresas com FCF TTM e SBC TTM válidos; sem um dos dois, ficam de fora (nunca zero no lugar). */
export function sbcRows(tickers: readonly { ticker: string; marketCapB: number }[], fcf: Record<string, number | undefined>, sbc: SbcTtm): SbcRow[] {
  const out: SbcRow[] = [];
  for (const c of tickers) {
    const f = fcf[c.ticker];
    const s = sbc[c.ticker];
    if (f === undefined || !Number.isFinite(f) || !s) continue;
    out.push({
      ticker: c.ticker,
      fcfB: f,
      sbcB: s.valueB,
      afterB: round1(f - s.valueB),
      sbcOfFcfPct: f > 0 ? round1((s.valueB / f) * 100) : null,
      yieldAfterPct: c.marketCapB > 0 ? round1(((f - s.valueB) / c.marketCapB) * 100) : null,
      asOf: s.asOf,
    });
  }
  return out;
}
