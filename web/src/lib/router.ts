export const TABS = [
  { id: "ind", label: "Indicadores" },
  { id: "val", label: "Valuation" },
  { id: "hist", label: "Histórico" },
  { id: "cred", label: "Crédito & CapEx" },
] as const;
export type Tab = (typeof TABS)[number]["id"];

export const HIST_METRICS = [
  { id: "rev", label: "Receita" },
  { id: "ni", label: "Lucro líquido" },
  { id: "margin", label: "Margem" },
  { id: "fcf", label: "FCF anual" },
] as const;
export type HistMetric = (typeof HIST_METRICS)[number]["id"];

export const PERIODS = [
  { id: "annual", label: "Ano fiscal" },
  { id: "quarter", label: "Trimestre" },
] as const;
export type Period = (typeof PERIODS)[number]["id"];

export const SORT_KEYS = ["name", "revenueB", "revGrowth", "operatingIncomeB", "netIncomeB", "netMargin", "epsDiluted", "marketCapB", "price"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const VAL_KEYS = ["name", "marketCapB", "pe", "peCore", "peFwd", "evEbitda", "divYield", "fcfYield", "fcfB", "grossMargin", "net", "evSales"] as const;
export type ValKey = (typeof VAL_KEYS)[number];

export interface Route {
  tab: Tab;
  metric: HistMetric;
  /** Só na aba Indicadores. */
  period: Period;
  sort: SortKey;
  /** 1 = crescente, -1 = decrescente. */
  dir: 1 | -1;
  /** Só na aba Valuation (tabela "Múltiplos e caixa"). */
  valSort: ValKey;
  valDir: 1 | -1;
}

/**
 * "#val" → aba val; "#hist-ni" → aba hist, métrica ni. Hash vazio, desconhecido ou malformado cai em
 * Indicadores / Receita. (Só `#nome` simples: o artefato hospedeiro não preserva `#/caminho`.)
 */
export function parseRoute(hash: string): Route {
  const id = hash.replace(/^#/, "");
  const [head, ...rest] = id.split("-");
  const tab = TABS.find((t) => t.id === head)?.id ?? "ind";
  const metric = tab === "hist" ? (HIST_METRICS.find((m) => m.id === rest[0])?.id ?? "rev") : "rev";
  // Indicadores: "#ind-quarter-revenueB-asc" (cada parte é opcional e só vale se for conhecida; o resto é ignorado).
  const ind = tab === "ind" ? rest : [];
  const period = PERIODS.find((x) => ind.includes(x.id))?.id ?? "annual";
  const sort = SORT_KEYS.find((k) => ind.includes(k)) ?? "marketCapB";
  const dir = ind.includes("asc") ? 1 : -1;
  // Valuation: "#val-pe-asc" (mesma regra: parte desconhecida é ignorada).
  const val = tab === "val" ? rest : [];
  const valSort = VAL_KEYS.find((k) => val.includes(k)) ?? "marketCapB";
  const valDir = val.includes("asc") ? 1 : -1;
  return { tab, metric, period, sort, dir, valSort, valDir };
}

export const parseTab = (hash: string): Tab => parseRoute(hash).tab;
export const tabHash = (t: Tab): string => `#${t}`;
export const metricHash = (m: HistMetric): string => (m === "rev" ? "#hist" : `#hist-${m}`);

/** "#ind", "#ind-quarter", "#ind-quarter-revenueB-asc": só grava o que difere do padrão (anual, marketCapB, decrescente). */
export function indHash(period: Period, sort: SortKey, dir: 1 | -1): string {
  const parts = ["ind"];
  if (period !== "annual") parts.push(period);
  if (sort !== "marketCapB" || dir !== -1) {
    parts.push(sort);
    if (dir === 1) parts.push("asc");
  }
  return `#${parts.join("-")}`;
}

/** "#val", "#val-pe-asc": só grava o que difere do padrão (valor de mercado, decrescente). */
export function valHash(sort: ValKey, dir: 1 | -1): string {
  if (sort === "marketCapB" && dir === -1) return "#val";
  return `#val-${sort}${dir === 1 ? "-asc" : ""}`;
}
