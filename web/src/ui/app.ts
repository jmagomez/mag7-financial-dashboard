import { fmtDate } from "../lib/format.ts";
import { tradingDays, type Chip } from "../lib/freshness.ts";
import { HIST_METRICS, metricHash, TABS, tabHash, type Route } from "../lib/router.ts";
import { h, type VNode } from "../lib/vdom.ts";
import { capexOcfChart, cdsChart, evEbitdaChart, fcfYieldChart, marketCapChart, peChart } from "./charts.ts";
import { briefCard } from "./brief.ts";
import { chartFrame } from "./chart-frame.ts";
import { historySpec } from "./history.ts";
import { lineFrame } from "./line-frame.ts";
import { FCF_NOTES, HIST_NOTES, type Note } from "./notes.ts";
import type { ViewModel } from "./model.ts";

export type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; model: ViewModel };

function priceChip(m: ViewModel): Chip {
  const n = tradingDays(m.marketSnapshot, m.generated);
  const level = n <= 1 ? "fresh" : n <= 3 ? "aging" : "stale";
  const word = level === "fresh" ? "atual" : level === "aging" ? "atenção" : "defasado";
  return { level, text: `${word} · preços de ${fmtDate(m.marketSnapshot)} · ${n} pregão(ões)` };
}

const notes = (items: Note[]): VNode => h("ul", { class: "notes" }, ...items.map((n) => h("li", {}, ...n)));

function panel({ tab, metric }: Route, m: ViewModel): VNode {
  switch (tab) {
    case "ind":
      return h("div", { class: "stack" }, m.brief ? briefCard(m.brief, m.generated) : null, h("div", { class: "grid" }, chartFrame(marketCapChart(m))));
    case "val":
      return h("div", { class: "grid" }, chartFrame(peChart(m)), chartFrame(evEbitdaChart(m)), chartFrame(fcfYieldChart(m)));
    case "cred":
      return h("div", { class: "grid" }, chartFrame(cdsChart(m)), chartFrame(capexOcfChart(m)));
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
      chip ? h("p", {}, h("span", { class: `chip chip-${chip.level}` }, chip.text), " ", `Arquivo gerado em ${state.status === "ready" ? fmtDate(state.model.generated) : ""}.`) : null,
    ),
    h(
      "nav",
      { role: "tablist", "aria-label": "Seções do dashboard", id: "tabs" },
      ...TABS.map((t) => h("a", { role: "tab", id: `t-${t.id}`, href: tabHash(t.id), "aria-selected": String(t.id === tab), "aria-controls": "panel", tabindex: t.id === tab ? "0" : "-1" }, t.label)),
    ),
    h("main", { id: "panel", role: "tabpanel", "aria-labelledby": `t-${tab}` }, body),
    h("footer", {}, "Informativo, sem recomendação de investimento. Dados de fontes públicas; veja as datas em cada indicador."),
  );
}
