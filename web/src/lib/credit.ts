/** Cálculos da aba Crédito & CapEx que não pertencem ao núcleo financeiro: intensidade de CapEx e leitura dos snapshots. */

/** CapEx do último ano ÷ receita do mesmo ano, em %, 1 casa (mesma fórmula do painel atual). null se faltar receita válida. */
export function capexIntensity(capex: readonly number[], revenueB: number | undefined): number | null {
  const last = capex[capex.length - 1];
  if (last === undefined || !Number.isFinite(last)) return null;
  if (revenueB === undefined || !Number.isFinite(revenueB) || revenueB <= 0) return null;
  return Math.round((last / revenueB) * 1000) / 10;
}

import { parseQuality, type Quality } from "./quality.ts";

export interface Snapshot {
  date: string;
  cds: Record<string, number | null>;
  /** Preços de fechamento por ticker; ausente em snapshots antigos. */
  prices: Record<string, number | null> | null;
  /** Qualidade dos dados do dia (gravada por daily.py); ausente em snapshots antigos ou malformada. */
  quality?: Quality;
}

const numRow = (o: unknown): Record<string, number | null> | null => {
  if (typeof o !== "object" || o === null || Array.isArray(o)) return null;
  const row: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(o)) row[k] = typeof v === "number" && Number.isFinite(v) ? v : null;
  return row;
};

/**
 * Lê history/snapshots.json de forma tolerante: ignora entradas sem data válida; `cds` e `prices` ausentes viram {} e
 * null, e valores não numéricos viram null. Nunca lança — dado ruim aqui não pode derrubar o dashboard. Ordena por data.
 */
export function parseSnapshots(raw: unknown): Snapshot[] {
  const list = (raw as { snapshots?: unknown } | null)?.snapshots;
  if (!Array.isArray(list)) return [];
  const out: Snapshot[] = [];
  for (const e of list) {
    if (typeof e !== "object" || e === null) continue;
    const { date, cds, prices, quality } = e as { date?: unknown; cds?: unknown; prices?: unknown; quality?: unknown };
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const q = parseQuality(quality);
    out.push({ date, cds: numRow(cds) ?? {}, prices: numRow(prices), ...(q ? { quality: q } : {}) });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Variações entre os dois últimos snapshots, só para quem tem valor nos dois e mudou. */
export function lastChange(snaps: readonly Snapshot[], tickers: readonly string[]): { from: string; to: string; moves: string[] } | null {
  if (snaps.length < 2) return null;
  const a = snaps[snaps.length - 2] as Snapshot;
  const b = snaps[snaps.length - 1] as Snapshot;
  const moves = tickers.flatMap((t) => {
    const x = a.cds[t];
    const y = b.cds[t];
    return x != null && y != null && x !== y ? [`${t} ${x} → ${y} bps`] : [];
  });
  return { from: a.date, to: b.date, moves };
}
