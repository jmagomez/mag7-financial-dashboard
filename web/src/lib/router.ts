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

export interface Route {
  tab: Tab;
  metric: HistMetric;
}

/**
 * "#val" → aba val; "#hist-ni" → aba hist, métrica ni. Hash vazio, desconhecido ou malformado cai em
 * Indicadores / Receita. (Só `#nome` simples: o artefato hospedeiro não preserva `#/caminho`.)
 */
export function parseRoute(hash: string): Route {
  const id = hash.replace(/^#/, "");
  const [head, sub] = id.split("-", 2);
  const tab = TABS.find((t) => t.id === head)?.id ?? "ind";
  const metric = tab === "hist" ? (HIST_METRICS.find((m) => m.id === sub)?.id ?? "rev") : "rev";
  return { tab, metric };
}

export const parseTab = (hash: string): Tab => parseRoute(hash).tab;
export const tabHash = (t: Tab): string => `#${t}`;
export const metricHash = (m: HistMetric): string => (m === "rev" ? "#hist" : `#hist-${m}`);
