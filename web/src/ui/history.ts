import { fmtNum } from "../lib/format.ts";
import { marginSeries } from "../lib/history.ts";
import type { HistMetric } from "../lib/router.ts";
import type { LineSpec, Series } from "./line-frame.ts";
import type { ViewModel } from "./model.ts";

const NAME: Record<HistMetric, string> = { rev: "Receita", ni: "Lucro líquido", margin: "Margem líquida", fcf: "FCF anual" };

export function historySpec(m: ViewModel, metric: HistMetric): LineSpec {
  const series: Series[] = m.companies.map((c) => ({
    label: c.ticker,
    values: metric === "rev" ? c.revHistory : metric === "ni" ? c.niHistory : metric === "fcf" ? c.fcfAnnual : marginSeries(c.niHistory, c.revHistory),
  }));
  const periods = metric === "fcf" ? m.fcfPeriods : m.periods;
  const pct = metric === "margin";
  const last = periods.length - 1;
  const lead = series
    .map((s) => ({ l: s.label, v: s.values[last] ?? null }))
    .filter((d): d is { l: string; v: number } => d.v !== null)
    .sort((a, b) => b.v - a.v)[0];
  const range = periods.length ? `${periods[0]} a ${periods[last]}` : "";
  const unit = pct ? "%" : "US$ bilhões";
  const summary = lead
    ? `Maior valor em ${periods[last]}: ${lead.l}, ${fmtNum(lead.v, 1)}${pct ? "%" : " US$ bi"}. ${series.length} empresas, ${periods.length} períodos.${metric === "ni" || metric === "margin" ? " Leia as notas abaixo: itens pontuais distorcem alguns trimestres." : ""}`
    : "Sem dados válidos.";
  return {
    id: `h-${metric}`,
    title: NAME[metric],
    subtitle: `${unit} · ${range}`,
    summary,
    suffix: pct ? "%" : "",
    periods,
    series,
  };
}
