/** Lógica da aba Indicadores (KPIs agregados, ordenação e variação de preço), portada do painel atual (index.html). */
import { fmtNum } from "./format.ts";
import type { Period, SortKey } from "./router.ts";
import type { Snapshot } from "./credit.ts";

export interface PeriodData {
  period?: string;
  revenueB?: number;
  revGrowth?: number;
  netIncomeB?: number;
  operatingIncomeB?: number;
  netMargin?: number;
  epsDiluted?: number;
  epsNonGaap?: number;
  note?: string;
}
export interface IndRow {
  ticker: string;
  name: string;
  color: string | null;
  price: number;
  marketCapB: number;
  annual: PeriodData;
  quarter: PeriodData;
}

/** US$ bi; a partir de 1.000 bi vira trilhões (mesmo formato do painel atual). */
export function money(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "n/d";
  return n >= 1000 ? `$${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tri` : `$${fmtNum(n, 0)} bi`;
}

export interface Kpi {
  label: string;
  value: string;
}
/** Receita, lucro, margem agregada e valor de mercado. Se alguma empresa não tem o dado do período, o total vira "n/d" (nunca uma soma parcial). */
export function kpis(rows: readonly IndRow[], period: Period): Kpi[] {
  const sumOf = (pick: (r: IndRow) => number | undefined): number | null => {
    let t = 0;
    for (const r of rows) {
      const v = pick(r);
      if (v === undefined || !Number.isFinite(v)) return null;
      t += v;
    }
    return rows.length ? t : null;
  };
  const rev = sumOf((r) => r[period].revenueB);
  const ni = sumOf((r) => r[period].netIncomeB);
  const cap = sumOf((r) => r.marketCapB);
  const margin = rev !== null && ni !== null && rev > 0 ? (ni / rev) * 100 : null;
  return [
    { label: "Receita somada", value: money(rev) },
    { label: "Lucro líquido somado", value: money(ni) },
    { label: "Margem agregada", value: margin === null ? "n/d" : `${fmtNum(margin, 1)}%` },
    { label: "Valor de mercado", value: money(cap) },
  ];
}

const valueOf = (r: IndRow, key: SortKey, period: Period): number | string | null => {
  if (key === "name") return r.name;
  if (key === "marketCapB") return r.marketCapB;
  if (key === "price") return r.price;
  return r[period][key] ?? null;
};

/** Ordena sem alterar a entrada. Sem valor vai sempre para o fim (em qualquer sentido); empate mantém a ordem original. */
export function sortRows(rows: readonly IndRow[], key: SortKey, dir: 1 | -1, period: Period): IndRow[] {
  return rows
    .map((r, i) => ({ r, i, v: valueOf(r, key, period) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
      const c = typeof a.v === "string" && typeof b.v === "string" ? a.v.localeCompare(b.v, "pt-BR") : (a.v as number) - (b.v as number);
      return c * dir || a.i - b.i;
    })
    .map((o) => o.r);
}

/**
 * Variação do preço contra o pregão anterior registrado nos snapshots. Referência: o último snapshot com preços; se ele
 * já é do dia do preço atual (>= marketSnapshot), compara com o anterior; senão (snapshot atrasado) compara com ele mesmo.
 */
export function priceDeltas(rows: readonly IndRow[], snaps: readonly Snapshot[] | null, marketSnapshot: string): { from: string | null; byTicker: Record<string, number | null> } {
  const withPrices = (snaps ?? []).filter((s) => s.prices !== null);
  const last = withPrices[withPrices.length - 1];
  const prev = withPrices.length > 1 && last ? (last.date >= marketSnapshot ? (withPrices[withPrices.length - 2] as Snapshot) : last) : null;
  const byTicker: Record<string, number | null> = {};
  for (const r of rows) {
    const p0 = prev?.prices?.[r.ticker];
    byTicker[r.ticker] = p0 ? (r.price / p0 - 1) * 100 : null;
  }
  return { from: prev ? prev.date : null, byTicker };
}

/** Regra dos 40 = crescimento de receita (%) + margem de FCF (%), uma casa decimal (mesma conta do painel atual). null sem os três dados ou com receita ≤ 0. */
export function rule40(growth: number | undefined, fcf: number | undefined, revenue: number | undefined): number | null {
  if (growth === undefined || fcf === undefined || revenue === undefined || !(revenue > 0)) return null;
  return Math.round((growth + (fcf / revenue) * 100) * 10) / 10;
}

/** Lucro líquido ÷ lucro operacional (x). Só existe com operacional > 0: acima de ~1,5x o excesso costuma ser item não operacional. */
export function netOverOperating(op: number | undefined, net: number | undefined): number | null {
  if (op === undefined || net === undefined || !(op > 0)) return null;
  return net / op;
}
