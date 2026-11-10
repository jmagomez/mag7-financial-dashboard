/** Tabela de exportação: mesmas colunas e ordem do botão "Exportar dados (CSV)" do painel atual (index.html). */
import type { Cell } from "../lib/csv.ts";
import type { ViewModel } from "./model.ts";

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function csvTable(m: ViewModel): Cell[][] {
  const a = m.annualLabel;
  const q = m.quarterLabel.replace(/\s+/g, "-");
  const header = [
    "Ticker", "Empresa", "Preco_USD", "MarketCap_B", "Peso_pct",
    `Rev_${a}_B`, `RevGrowth_${a}_pct`, `NI_${a}_B`, `NetMargin_${a}_pct`, `EPS_${a}`,
    `Rev_${q}_B`, `RevGrowth_${q}_pct`, `OpInc_${q}_B`, `NI_${q}_B`, `NetMargin_${q}_pct`,
    "TTM_NI_B", "PE_TTM_GAAP", "PE_core_adj", "PE_forward_consenso", "EV_EBITDA", "DivYield_pct", "FCFYield_pct", "FCF_TTM_B", "GrossMargin_pct",
    "NetCash_B", "EV_B", "EV_Sales", "ImpliedFCFGrowth_10y_pct", `CapEx_${a}_B`, "CapExIntensity_pct",
    "CDS_bps", "Rating_SP", "Rating_Moody", "FCFYield_declarado_pct", "FCFYield_recalculado", "NetCash_pct_MarketCap", "CapEx_to_OCF_pct", "CDS_PD5y_implied_pct", "Snapshot_mercado",
  ];
  const rows = new Map(m.rows.map((r) => [r.ticker, r]));
  const audit = new Map(m.audit.companies.map((c) => [c.ticker, c]));
  const ratings = new Map(m.cds.filter((c) => !c.ref).map((c) => [c.ticker, c.rating]));
  const body = m.companies.map((c): Cell[] => {
    const r = rows.get(c.ticker);
    const au = audit.get(c.ticker);
    const d = m.derived[c.ticker];
    const v = d.valuation;
    const x = m.valuationExtras[c.ticker];
    const ra = ratings.get(c.ticker);
    const ann = r?.annual;
    const qu = r?.quarter;
    return [
      c.ticker, m.names[c.ticker] ?? c.ticker, c.price, c.marketCapB, au?.weight,
      ann?.revenueB, ann?.revGrowth, ann?.netIncomeB, ann?.netMargin, ann?.epsDiluted,
      qu?.revenueB, qu?.revGrowth, qu?.operatingIncomeB, qu?.netIncomeB, qu?.netMargin,
      round1(c.niHistory.slice(-4).reduce((s, n) => s + n, 0)), v.pe, v.peCore, v.peFwd, v.evEbitda, x?.divYield, v.fcfYield, v.fcfB, x?.grossMargin,
      v.net, v.ev, v.evSales, v.impliedG, c.capex[c.capex.length - 1], m.capexIntensity[c.ticker],
      c.cds, ra?.sp, ra?.moody, au?.fcfYieldSrc, au?.fcfRecalc ? "sim" : "nao", v.netPct, d.capexOcf, d.pd5, m.marketSnapshot,
    ];
  });
  return [header, ...body];
}

export const csvFilename = (m: ViewModel): string => `mag7_indicadores_${m.generated}.csv`;
