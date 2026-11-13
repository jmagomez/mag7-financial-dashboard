/** Qualidade dos dados por snapshot (gravada por src/daily.py em history/snapshots.json): nível dos preços e idade dos CDS das Mag 7. */
import { TIERS, type Tier } from "./provenance.ts";

export interface Quality {
  pricesTier: Tier;
  cdsCount: number;
  cdsAvgAgeDays: number;
  cdsMaxAgeDays: number;
  cdsStale: number;
}

const isNum = (x: unknown, lo: number, hi: number): x is number => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;

/** Ausente ou malformado → null (a linha some; o validador do CI é quem barra). */
export function parseQuality(raw: unknown): Quality | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const q = raw as Record<string, unknown>;
  const tier = TIERS.find((t) => t === q.pricesTier);
  if (!tier || !isNum(q.cdsCount, 1, 7) || !isNum(q.cdsAvgAgeDays, 0, 10000) || !isNum(q.cdsMaxAgeDays, 0, 10000) || !isNum(q.cdsStale, 0, 7)) return null;
  if (!Number.isInteger(q.cdsCount) || !Number.isInteger(q.cdsMaxAgeDays) || !Number.isInteger(q.cdsStale) || q.cdsStale > q.cdsCount || q.cdsMaxAgeDays < q.cdsAvgAgeDays) return null;
  return { pricesTier: tier, cdsCount: q.cdsCount, cdsAvgAgeDays: q.cdsAvgAgeDays, cdsMaxAgeDays: q.cdsMaxAgeDays, cdsStale: q.cdsStale };
}
