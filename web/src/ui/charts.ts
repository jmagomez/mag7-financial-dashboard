/** Montagem dos gráficos a partir do modelo. Nenhum número é calculado aqui: tudo vem de `finance.ts` ou dos dados. */
import { CDS_ALERT, pd5 } from "../lib/finance.ts";
import { fmtDateFull, fmtNum } from "../lib/format.ts";
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
