/** Séries históricas. A margem usa a MESMA fórmula do dashboard em produção: round1(lucro ÷ receita × 100), receita 0/ausente → null. */
export function margin(ni: number | undefined, rev: number | undefined): number | null {
  if (ni === undefined || !rev) return null;
  return Math.round((ni / rev) * 1000) / 10;
}

export const marginSeries = (ni: readonly number[], rev: readonly number[]): (number | null)[] => rev.map((r, i) => margin(ni[i], r));

/** Ticks "bonitos" (passo 1, 2, 2.5 ou 5 × 10^k) que cobrem [lo, hi]; sempre inclui 0 quando o intervalo o atravessa. */
export function niceTicks(lo: number, hi: number, target = 5): { ticks: number[]; min: number; max: number } {
  if (!(hi > lo)) {
    const base = Number.isFinite(lo) ? lo : 0;
    return { ticks: [base], min: base - 1, max: base + 1 };
  }
  const raw = (hi - lo) / Math.max(1, target - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? 10 * mag;
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 1e6; v += step) ticks.push(Math.round(v / step) * step);
  return { ticks, min, max };
}

/** Afasta rótulos que colidiriam (altura mínima `gap`), mantendo a ordem vertical e os limites [lo, hi]. */
export function spreadLabels(ys: readonly number[], gap: number, lo: number, hi: number): number[] {
  const idx = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const pos = idx.map((o) => Math.min(hi, Math.max(lo, o.y)));
  for (let k = 1; k < pos.length; k++) pos[k] = Math.max(pos[k] as number, (pos[k - 1] as number) + gap);
  for (let k = pos.length - 1; k >= 0; k--) {
    const limit = k === pos.length - 1 ? hi : (pos[k + 1] as number) - gap;
    pos[k] = Math.min(pos[k] as number, limit);
  }
  const out = new Array<number>(ys.length).fill(0);
  idx.forEach((o, k) => {
    out[o.i] = pos[k] as number;
  });
  return out;
}
