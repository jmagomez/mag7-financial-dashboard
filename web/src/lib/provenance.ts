/**
 * Proveniência dos números diários (`meta.provenance` de data.json, gravada por src/daily.py).
 * Opcional: arquivo antigo ou bloco malformado → null e o painel segue sem a seção (o validador do CI é quem barra o erro).
 */
export const TIERS = ["primary", "secondary", "derived"] as const;
export type Tier = (typeof TIERS)[number];
/** Espelha SHARES_ANCHOR_MAX_DAYS de src/common.py: acima disso o market cap diário pede nova âncora de ações. */
export const ANCHOR_MAX_DAYS = 90;

export interface ProvEntry {
  tier: Tier;
  asOf: string;
  source?: string;
  method?: string;
  anchor?: { date: string; source: string };
}
export interface Provenance {
  prices: ProvEntry;
  marketCapB: ProvEntry;
  weight: ProvEntry;
  cds: Record<string, ProvEntry>;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

function entry(x: unknown): ProvEntry | null {
  if (!isObj(x) || !TIERS.includes(x.tier as Tier) || typeof x.asOf !== "string" || !ISO.test(x.asOf)) return null;
  const e: ProvEntry = { tier: x.tier as Tier, asOf: x.asOf };
  if (typeof x.source === "string") e.source = x.source;
  if (typeof x.method === "string") e.method = x.method;
  const a = x.anchor;
  if (isObj(a) && typeof a.date === "string" && ISO.test(a.date) && typeof a.source === "string" && a.source) e.anchor = { date: a.date, source: a.source };
  return e;
}

export function parseProvenance(raw: unknown): Provenance | null {
  if (!isObj(raw) || !isObj(raw.cds)) return null;
  const prices = entry(raw.prices);
  const marketCapB = entry(raw.marketCapB);
  const weight = entry(raw.weight);
  if (!prices || !marketCapB || !weight) return null;
  const cds: Record<string, ProvEntry> = {};
  for (const [t, v] of Object.entries(raw.cds)) {
    const e = entry(v);
    if (!e) return null;
    cds[t] = e;
  }
  return { prices, marketCapB, weight, cds };
}

export const TIER_LABEL: Record<Tier, string> = {
  primary: "primária (emissor, bolsa ou SEC)",
  secondary: "secundária (agregador ou imprensa)",
  derived: "derivada (calculada)",
};
