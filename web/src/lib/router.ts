export const TABS = [
  { id: "ind", label: "Indicadores" },
  { id: "val", label: "Valuation" },
  { id: "hist", label: "Histórico" },
  { id: "cred", label: "Crédito & CapEx" },
] as const;
export type Tab = (typeof TABS)[number]["id"];

/** "#val" → "val"; hash vazio, desconhecido ou malformado cai em "ind". */
export function parseTab(hash: string): Tab {
  const id = hash.replace(/^#/, "");
  return TABS.find((t) => t.id === id)?.id ?? "ind";
}
export const tabHash = (t: Tab): string => `#${t}`;
