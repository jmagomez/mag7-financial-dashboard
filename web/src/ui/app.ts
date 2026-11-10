import { fmtDate } from "../lib/format.ts";
import { tradingDays, type Chip } from "../lib/freshness.ts";
import { HIST_METRICS, metricHash, TABS, tabHash, type Route } from "../lib/router.ts";
import { h, type VNode } from "../lib/vdom.ts";
import { capexIntensityChart, capexOcfChart, cdsChart, cloudChart, divYieldChart, earningsQualityChart, evEbitdaChart, fcfYieldChart, impliedGrowthChart, marketCapChart, netCashChart, peChart, peForwardChart, rule40Chart } from "./charts.ts";
import { briefCard } from "./brief.ts";
import { capexSpec, cdsLogBlock, footerBlock, ratingsTable, trendBlock, trendNotes } from "./credit.ts";
import { chartFrame } from "./chart-frame.ts";
import { signalsBlock } from "./signals.ts";
import { comparisonTable, kpiBlock, periodCharts, periodNav } from "./indicators.ts";
import { historySpec } from "./history.ts";
import { valuationTable } from "./valuation.ts";
import { scatterFrame } from "./scatter.ts";
import { lineFrame } from "./line-frame.ts";
import { CAPEX_INT_NOTES, CAPEX_NOTES, CAPEX_OCF_NOTES, FCF_NOTES, HIST_NOTES, PD_NOTES, VAL_NOTES, type Note } from "./notes.ts";
import type { ViewModel } from "./model.ts";

export type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; model: ViewModel };

function priceChip(m: ViewModel): Chip {
  const n = tradingDays(m.marketSnapshot, m.generated);
  const level = n <= 1 ? "fresh" : n <= 3 ? "aging" : "stale";
  const word = level === "fresh" ? "atual" : level === "aging" ? "atenção" : "defasado";
  return { level, text: `${word} · preços de ${fmtDate(m.marketSnapshot)} · ${n} pregão(ões)` };
}

const notes = (items: Note[]): VNode => h("ul", { class: "notes" }, ...items.map((n) => h("li", {}, ...n)));

function credPanel(m: ViewModel): VNode {
  const trend = trendBlock(m);
  return h(
    "div",
    { class: "stack" },
    lineFrame(capexSpec(m)),
    notes(CAPEX_NOTES),
    h("div", { class: "grid" }, chartFrame(capexIntensityChart(m)), chartFrame(capexOcfChart(m))),
    notes([...CAPEX_INT_NOTES, ...CAPEX_OCF_NOTES]),
    chartFrame(cdsChart(m)),
    ratingsTable(m),
    notes(PD_NOTES),
    trend.spec ? lineFrame(trend.spec) : h("p", { class: "card", role: "status" }, trend.message),
    trend.spec ? notes(trendNotes(m)) : null,
    m.creditNotes.length ? notes(m.creditNotes.map((n) => [n])) : null,
    cdsLogBlock(m),
  );
}

function panel(route: Route, m: ViewModel): VNode {
  const { tab, metric } = route;
  switch (tab) {
    case "ind":
      return h(
        "div",
        { class: "stack" },
        m.brief ? briefCard(m.brief, m.generated, m.glossary) : null,
        periodNav(route, m),
        kpiBlock(m, route.period),
        signalsBlock(m),
        h("div", { class: "grid" }, ...periodCharts(m, route.period).map(chartFrame), chartFrame(marketCapChart(m))),
        comparisonTable(route, m),
      );
    case "val":
      return h(
        "div",
        { class: "stack" },
        h("div", { class: "grid" }, chartFrame(peChart(m)), chartFrame(evEbitdaChart(m)), chartFrame(fcfYieldChart(m)), chartFrame(divYieldChart(m))),
        h("div", { class: "grid" }, chartFrame(peForwardChart(m)), chartFrame(earningsQualityChart(m)), chartFrame(rule40Chart(m)), chartFrame(netCashChart(m)), chartFrame(impliedGrowthChart(m))),
        m.cloudSegments.length ? chartFrame(cloudChart(m)) : null,
        scatterFrame(m),
        notes(VAL_NOTES),
        valuationTable(route, m),
      );
    case "cred":
      return credPanel(m);
    case "hist":
      return h(
        "div",
        { class: "stack" },
        h(
          "nav",
          { class: "seg", "aria-label": "Métrica do histórico" },
          ...HIST_METRICS.map((x) => h("a", { href: metricHash(x.id), "aria-current": x.id === metric ? "page" : undefined }, x.label)),
        ),
        lineFrame(historySpec(m, metric)),
        notes(metric === "fcf" ? FCF_NOTES : HIST_NOTES),
      );
  }
}

export function appView(state: State, route: Route): VNode {
  const tab = route.tab;
  const body =
    state.status === "loading"
      ? h("p", { role: "status" }, "Carregando dados…")
      : state.status === "error"
        ? h("p", { role: "alert", class: "err" }, `Não foi possível carregar os dados: ${state.message}`)
        : panel(route, state.model);
  const chip = state.status === "ready" ? priceChip(state.model) : null;
  return h(
    "div",
    { class: "wrap" },
    h(
      "header",
      {},
      h("h1", {}, "Magnificent 7 · indicadores financeiros"),
      state.status === "ready" ? h("p", {}, h("button", { type: "button", class: "btn", id: "csv-btn", "aria-label": "Exportar todos os dados do painel em arquivo CSV" }, "⭳ Exportar dados (CSV)")) : null,
      chip ? h("p", {}, h("span", { class: `chip chip-${chip.level}` }, chip.text), " ", `Arquivo gerado em ${state.status === "ready" ? fmtDate(state.model.generated) : ""}.`) : null,
    ),
    // Marcos: <main> contém abas e painel (axe: tudo dentro de landmark; role=tabpanel não é permitido em <main>).
    h(
      "main",
      {},
      h(
        "div",
        { role: "tablist", "aria-label": "Seções do dashboard", id: "tabs" },
        ...TABS.map((t) => h("a", { role: "tab", id: `t-${t.id}`, href: tabHash(t.id), "aria-selected": String(t.id === tab), "aria-controls": "panel", tabindex: t.id === tab ? "0" : "-1" }, t.label)),
      ),
      h("div", { id: "panel", role: "tabpanel", "aria-labelledby": `t-${tab}` }, body),
    ),
    state.status === "ready" ? footerBlock(state.model) : h("footer", {}, "Informativo, sem recomendação de investimento."),
  );
}
