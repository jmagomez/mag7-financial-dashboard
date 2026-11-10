/** Montagem dos gráficos a partir do modelo. Nenhum número é calculado aqui: tudo vem de `finance.ts` ou dos dados. */
import { CDS_ALERT, pd5 } from "../lib/finance.ts";
import { fmtDateFull, fmtNum } from "../lib/format.ts";
import { netOverOperating, rule40 } from "../lib/indicators.ts";
import { CAPEX_OCF_WARN } from "../lib/signals.ts";
import { ageChip, CDS_STALE_AFTER_DAYS } from "../lib/freshness.ts";
import type { BarDatum, ChartSpec } from "./chart-frame.ts";
import { ranked } from "./chart-frame.ts";
import type { ViewModel } from "./model.ts";

function leader(data: BarDatum[], unit: string, digits: number, what: string): string {
  const top = ranked(data).find((d) => d.value !== null && !d.dim);
  return top && top.value !== null ? `${what}: ${top.label}, ${fmtNum(top.value, digits)} ${unit}.` : "Sem dados válidos.";
}

function byCompany(m: ViewModel, pick: (t: ViewModel["companies"][number]) => number | null): BarDatum[] {
  return m.companies.map((c) => ({ label: m.names[c.ticker] ?? c.ticker, value: pick(c) }));
}

export function marketCapChart(m: ViewModel): ChartSpec {
  const data = byCompany(m, (c) => c.marketCapB);
  return { id: "c-mcap", title: "Capitalização de mercado", unit: "US$ bi", digits: 0, data, summary: `${leader(data, "US$ bi", 0, "Maior")} Preços de fechamento de ${fmtDateFull(m.marketSnapshot)}.` };
}

export function peChart(m: ViewModel): ChartSpec {
  const data = byCompany(m, (c) => m.derived[c.ticker].valuation.pe);
  return { id: "c-pe", title: "P/E (lucro líquido, 4 trimestres)", unit: "x", data, summary: `${leader(data, "x", 1, "Maior múltiplo")} Empresas com lucro ≤ 0 aparecem como n/d.` };
}

export function evEbitdaChart(m: ViewModel): ChartSpec {
  const data = byCompany(m, (c) => m.derived[c.ticker].valuation.evEbitda);
  return { id: "c-evebitda", title: "EV/EBITDA (EBITDA implícito)", unit: "x", data, summary: leader(data, "x", 1, "Maior múltiplo") };
}

export function fcfYieldChart(m: ViewModel): ChartSpec {
  const data = byCompany(m, (c) => m.derived[c.ticker].valuation.fcfYield);
  return { id: "c-fcfy", title: "FCF yield (fluxo de caixa livre ÷ valor de mercado)", unit: "%", data, summary: leader(data, "%", 1, "Maior rendimento") };
}

export function divYieldChart(m: ViewModel): ChartSpec {
  // 0 ou ausente = não paga dividendo: aparece como n/d, não como barra de zero.
  const data = byCompany(m, (c) => {
    const v = m.valuationExtras[c.ticker]?.divYield ?? null;
    return v !== null && v > 0 ? v : null;
  });
  return { id: "c-divy", title: "Dividend yield", unit: "%", digits: 2, data, summary: `${leader(data, "%", 2, "Maior rendimento")} Empresas sem dividendo aparecem como n/d.` };
}

export { CAPEX_OCF_WARN };

export function capexIntensityChart(m: ViewModel): ChartSpec {
  const data = byCompany(m, (c) => m.capexIntensity[c.ticker] ?? null);
  return { id: "c-capexint", title: "Intensidade de CapEx (CapEx ÷ receita, último ano fiscal)", unit: "%", data, summary: leader(data, "%", 1, "Maior intensidade") };
}

export function capexOcfChart(m: ViewModel): ChartSpec {
  const data = byCompany(m, (c) => m.derived[c.ticker].capexOcf);
  const high = data.filter((d) => d.value !== null && d.value >= CAPEX_OCF_WARN).map((d) => d.label);
  const warn = high.length ? `Em ${CAPEX_OCF_WARN}% ou mais (CapEx absorve quase todo o caixa operacional): ${high.join(", ")}.` : `Nenhuma com ${CAPEX_OCF_WARN}% ou mais.`;
  return { id: "c-capex", title: "CapEx ÷ caixa operacional (último ano fiscal)", unit: "%", data, summary: `${leader(data, "%", 1, "Maior intensidade")} ${warn}` };
}

export function cdsChart(m: ViewModel): ChartSpec {
  const data: BarDatum[] = m.cds.map((r) => {
    const chip = ageChip(r.asOf, m.generated, CDS_STALE_AFTER_DAYS);
    const p = pd5(r.bps);
    return {
      label: r.ref ? `${r.name} (ref.)` : r.name,
      value: r.bps,
      chip: r.bps === null ? undefined : chip,
      dim: r.bps !== null && chip.level === "stale",
      cells: [p === null ? "n/d" : `${fmtNum(p, 1)}%`],
    };
  });
  const stale = data.filter((d) => d.dim).length;
  const alerts = data.filter((d) => !d.dim && d.value !== null && d.value > CDS_ALERT).map((d) => d.label);
  const parts = [
    leader(data, "bps", 0, "Maior CDS atual"),
    alerts.length ? `Acima de ${CDS_ALERT} bps: ${alerts.join(", ")}.` : `Nenhum acima de ${CDS_ALERT} bps entre os níveis atuais.`,
    stale ? `${stale} nível(is) com mais de ${CDS_STALE_AFTER_DAYS} dias ficam esmaecidos e fora do ranking.` : "",
  ];
  return { id: "c-cds", title: "CDS de 5 anos", unit: "bps", digits: 0, data, columns: ["PD 5a implícita (R = 40%)"], summary: parts.filter(Boolean).join(" ") };
}

export function rule40Chart(m: ViewModel): ChartSpec {
  const rows = new Map(m.rows.map((r) => [r.ticker, r.annual]));
  const data = byCompany(m, (c) => {
    const a = rows.get(c.ticker);
    return rule40(a?.revGrowth, c.fcfAnnual[c.fcfAnnual.length - 1], a?.revenueB);
  });
  const above = data.filter((d) => d.value !== null && d.value >= 40).map((d) => d.label);
  const where = above.length ? `Em 40% ou mais: ${above.join(", ")}.` : "Nenhuma chega a 40%.";
  return {
    id: "c-rule40",
    title: "Regra dos 40 (crescimento de receita + margem de FCF)",
    unit: "%",
    data,
    summary: `${leader(data, "%", 1, "Maior")} ${where} Heurística de software/tech: crescimento a/a e FCF ÷ receita do último ano fiscal; 40% é o limiar.`,
  };
}

export function netCashChart(m: ViewModel): ChartSpec {
  const data: BarDatum[] = m.companies.map((c) => {
    const b = m.balance[c.ticker];
    return {
      label: m.names[c.ticker] ?? c.ticker,
      value: m.derived[c.ticker].valuation.net,
      cells: b ? [fmtNum(b.cash, 0), fmtNum(b.debt, 0)] : ["n/d", "n/d"],
    };
  });
  const neg = data.filter((d) => d.value !== null && d.value < 0).map((d) => d.label);
  const where = neg.length ? `Dívida líquida (valor negativo, sem barra): ${neg.join(", ")}.` : "Nenhuma em dívida líquida.";
  return {
    id: "c-netcash",
    title: "Caixa líquido (+) ou dívida líquida (−)",
    unit: "US$ bi",
    digits: 1,
    data,
    columns: ["Caixa + títulos", "Dívida financiada"],
    summary: `${leader(data, "US$ bi", 1, "Maior caixa líquido")} ${where} Balanços do 2T 2026.`,
  };
}

export function impliedGrowthChart(m: ViewModel): ChartSpec {
  const data = byCompany(m, (c) => m.derived[c.ticker].valuation.impliedG);
  return {
    id: "c-implied",
    title: "O que está no preço: crescimento de FCF implícito (DCF reverso)",
    unit: "% a.a.",
    data,
    summary: `${leader(data, "% a.a.", 1, "Maior crescimento embutido")} CAGR de FCF em 10 anos que o EV atual embute, com WACC 9% e crescimento terminal 3%.`,
  };
}

export function peForwardChart(m: ViewModel): ChartSpec {
  const data = byCompany(m, (c) => m.derived[c.ticker].valuation.peFwd);
  return { id: "c-pefwd", title: "P/E forward (consenso)", unit: "x", digits: 1, data, summary: `${leader(data, "x", 1, "Maior múltiplo")} Estimativas de consenso reescaladas ao preço atual; compare com o P/E TTM acima.` };
}

export function earningsQualityChart(m: ViewModel): ChartSpec {
  const q = new Map(m.rows.map((r) => [r.ticker, r.quarter]));
  const data: BarDatum[] = m.companies.map((c) => {
    const p = q.get(c.ticker);
    return {
      label: m.names[c.ticker] ?? c.ticker,
      value: netOverOperating(p?.operatingIncomeB, p?.netIncomeB),
      cells: [p?.operatingIncomeB === undefined ? "n/d" : fmtNum(p.operatingIncomeB, 1), p?.netIncomeB === undefined ? "n/d" : fmtNum(p.netIncomeB, 1)],
    };
  });
  const high = data.filter((d) => d.value !== null && d.value >= 1.5).map((d) => `${d.label} (${fmtNum(d.value, 1)}x)`);
  const where = high.length ? `Líquido muito acima do operacional (excesso provavelmente não operacional, sem caixa): ${high.join(", ")}.` : "Nenhuma com o líquido 1,5x ou mais acima do operacional.";
  return {
    id: "c-quality",
    title: "Qualidade do lucro: lucro líquido ÷ lucro operacional (GAAP)",
    unit: "x",
    digits: 2,
    data,
    columns: ["Operacional (US$ bi)", "Líquido (US$ bi)"],
    summary: `${where} Abaixo de 1x o líquido é menor que o operacional (impostos): lucro de alta qualidade. Trimestre de referência; sem operacional positivo, n/d.`,
  };
}
