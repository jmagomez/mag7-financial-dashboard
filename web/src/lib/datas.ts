/**
 * Data, nível e fonte de cada número de entrada de `derived` (Fase 3): lê os blocos já migrados para o formato v2
 * (`{value|cash/debt, asOf, tier, source}`) direto do fundamentals.json. Entrada malformada fica de fora (nada é inventado);
 * bloco ausente ou ainda com número solto não gera linha.
 */
import { TIERS } from "./provenance.ts";

export interface DateRow {
  block: string;
  /** Rótulo do dado em português. */
  what: string;
  ticker: string;
  asOf: string;
  tier: (typeof TIERS)[number];
  source: { label: string; url: string };
}

/** Blocos migrados e seus rótulos, na ordem de exibição. */
export const V2_BLOCKS: readonly (readonly [string, string])[] = [
  ["fcfTTM", "FCF dos últimos 12 meses"],
  ["oneOffTTM", "Itens não recorrentes (ajuste do P/E core)"],
  ["ebitdaImplB", "EBITDA implícito"],
  ["balanceQ2_2026", "Caixa e dívida financiada"],
  ["fwdPE", "P/E forward (consenso)"],
  ["fwdEPS", "LPA forward implícito"],
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

export function derivedDateRows(derived: unknown): DateRow[] {
  if (!isObj(derived)) return [];
  const out: DateRow[] = [];
  for (const [block, what] of V2_BLOCKS) {
    const blk = derived[block];
    if (!isObj(blk)) continue;
    for (const [ticker, e] of Object.entries(blk)) {
      if (!isObj(e) || typeof e.asOf !== "string" || !ISO.test(e.asOf)) continue;
      const tier = TIERS.find((t) => t === e.tier);
      const s = e.source;
      if (!tier || !isObj(s) || typeof s.label !== "string" || typeof s.url !== "string") continue;
      out.push({ block, what, ticker, asOf: e.asOf, tier, source: { label: s.label, url: s.url } });
    }
  }
  return out;
}
