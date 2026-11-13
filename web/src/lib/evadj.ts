/**
 * EV ajustado: EV da tabela de múltiplos (market cap − caixa líquido) + arrendamentos operacionais + arrendamentos financeiros
 * + participação de não controladores, no balanço do 2T 2026 (`derived.evAdjust` de fundamentals.json, com fonte e data).
 * Só entra empresa com os três itens confirmados; as demais ficam n/d (nada é estimado). Opcional: bloco ausente → null.
 */
export interface EvAdjEntry {
  opLeaseB: number;
  finLeaseB: number;
  nciB: number;
  asOf: string;
  source: { label: string; url: string };
}
export type EvAdjust = Record<string, EvAdjEntry>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const nonNeg = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 500;

export function parseEvAdjust(raw: unknown): EvAdjust | null {
  if (!isObj(raw)) return null;
  const out: EvAdjust = {};
  for (const [t, v] of Object.entries(raw)) {
    if (!isObj(v) || !nonNeg(v.opLeaseB) || !nonNeg(v.finLeaseB) || !nonNeg(v.nciB)) continue;
    if (typeof v.asOf !== "string" || !ISO.test(v.asOf)) continue;
    const s = v.source;
    if (!isObj(s) || typeof s.label !== "string" || typeof s.url !== "string") continue;
    out[t] = { opLeaseB: v.opLeaseB, finLeaseB: v.finLeaseB, nciB: v.nciB, asOf: v.asOf, source: { label: s.label, url: s.url } };
  }
  return Object.keys(out).length > 0 ? out : null;
}

export interface EvAdjRow {
  ticker: string;
  /** EV da tabela de múltiplos (US$ bi, conta exata, sem arredondar). */
  evB: number;
  opLeaseB: number;
  finLeaseB: number;
  nciB: number;
  adjustedB: number;
  /** Quanto o EV ajustado excede o EV (%), 1 casa; null se o EV ≤ 0. */
  upliftPct: number | null;
  asOf: string;
}

/** `evExact`: EV por ticker já calculado (market cap − caixa líquido); sem EV ou sem entrada, a empresa fica de fora. */
export function evAdjRows(tickers: readonly string[], evExact: Record<string, number | undefined>, adj: EvAdjust): EvAdjRow[] {
  const out: EvAdjRow[] = [];
  for (const t of tickers) {
    const ev = evExact[t];
    const a = adj[t];
    if (ev === undefined || !Number.isFinite(ev) || !a) continue;
    const adjusted = ev + a.opLeaseB + a.finLeaseB + a.nciB;
    out.push({
      ticker: t,
      evB: ev,
      opLeaseB: a.opLeaseB,
      finLeaseB: a.finLeaseB,
      nciB: a.nciB,
      adjustedB: adjusted,
      upliftPct: ev > 0 ? Math.round(((adjusted - ev) / ev) * 1000) / 10 : null,
      asOf: a.asOf,
    });
  }
  return out;
}
