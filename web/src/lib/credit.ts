/** Cálculos da aba Crédito & CapEx que não pertencem ao núcleo financeiro: intensidade de CapEx e leitura dos snapshots. */

/** CapEx do último ano ÷ receita do mesmo ano, em %, 1 casa (mesma fórmula do painel atual). null se faltar receita válida. */
export function capexIntensity(capex: readonly number[], revenueB: number | undefined): number | null {
  const last = capex[capex.length - 1];
  if (last === undefined || !Number.isFinite(last)) return null;
  if (revenueB === undefined || !Number.isFinite(revenueB) || revenueB <= 0) return null;
  return Math.round((last / revenueB) * 1000) / 10;
}

export interface Snapshot {
  date: string;
  cds: Record<string, number | null>;
}

/**
 * Lê history/snapshots.json de forma tolerante: ignora entradas sem data válida ou sem `cds`, e valores não numéricos
 * viram null. Nunca lança — dado ruim aqui não pode derrubar o dashboard. Ordena por data.
 */
export function parseSnapshots(raw: unknown): Snapshot[] {
  const list = (raw as { snapshots?: unknown } | null)?.snapshots;
  if (!Array.isArray(list)) return [];
  const out: Snapshot[] = [];
  for (const e of list) {
    if (typeof e !== "object" || e === null) continue;
    const { date, cds } = e as { date?: unknown; cds?: unknown };
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (typeof cds !== "object" || cds === null || Array.isArray(cds)) continue;
    const row: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(cds)) row[k] = typeof v === "number" && Number.isFinite(v) ? v : null;
    out.push({ date, cds: row });
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
