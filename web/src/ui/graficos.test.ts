import assert from "node:assert/strict";
import { test } from "node:test";
import { netOverOperating, rule40 } from "../lib/indicators.ts";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { toHtml } from "../lib/vdom.ts";
import { chartFrame } from "./chart-frame.ts";
import { earningsQualityChart, netCashChart, rule40Chart } from "./charts.ts";
import { buildModel } from "./model.ts";

test("regra dos 40: arredonda em 1 casa e vira null sem dado ou com receita ≤ 0", () => {
  assert.equal(rule40(10, 25, 100), 35);
  assert.equal(rule40(114.2, 60.9, 130.5), 160.9); // 114,2 + 46,67 = 160,87
  assert.equal(rule40(5, 10, 0), null);
  assert.equal(rule40(undefined, 10, 100), null);
  assert.equal(rule40(5, undefined, 100), null);
});

test("líquido ÷ operacional: só com operacional positivo", () => {
  assert.equal(netOverOperating(40, 112), 2.8);
  assert.equal(netOverOperating(0.4, 1.11), 1.11 / 0.4);
  assert.equal(netOverOperating(0, 5), null);
  assert.equal(netOverOperating(-1, 5), null);
  assert.equal(netOverOperating(undefined, 5), null);
});

const daily = {
  meta: { generated: "2026-11-09", marketSnapshot: "2026-11-06", totalMarketCapT: 1 },
  companies: [
    { ticker: "AAA", price: 10, marketCapB: 500, weight: 50, cds: null },
    { ticker: "BBB", price: 10, marketCapB: 900, weight: 50, cds: null },
  ],
} as unknown as DailyFile;
const co = (t: string, name: string, annual: object, quarter: object) => ({ ticker: t, name, annual, quarter, revHistory: [1], niHistory: [1], fcfAnnual: [30], capex: [1], valuation: {} });
const fund = {
  meta: {},
  companies: [
    co("AAA", "Alfa <script>x</script>", { revenueB: 100, revGrowth: 20 }, { operatingIncomeB: 40, netIncomeB: 112 }),
    co("BBB", "Beta", { revenueB: 100, revGrowth: 5 }, { operatingIncomeB: 20, netIncomeB: 15 }),
  ],
  derived: { balanceQ2_2026: { AAA: { cash: 100, debt: 30 } }, fcfTTM: {}, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {} },
} as unknown as FundamentalsFile;

test("gráficos novos: valores, avisos no resumo, colunas extras e texto escapado", () => {
  const m = buildModel(daily, fund);
  const r = rule40Chart(m);
  assert.equal(r.data.find((d) => d.label === "Beta")?.value, 35);
  assert.ok(r.summary.includes("Em 40% ou mais: Alfa")); // 20 + 30 = 50
  const q = earningsQualityChart(m);
  assert.equal(q.data.find((d) => d.label === "Beta")?.value, 0.75);
  assert.ok(q.summary.includes("(2,8x)"));
  const n = netCashChart(m);
  assert.deepEqual(n.data[0]?.cells, ["100", "30"]);
  assert.deepEqual(n.data[1]?.cells, ["n/d", "n/d"]); // sem balanço: n/d, nunca zero
  const html = toHtml(chartFrame(q)) + toHtml(chartFrame(n)) + toHtml(chartFrame(r));
  assert.ok(!html.includes("<script>x") && html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("NaN") && !html.includes("undefined") && !html.includes("Infinity"));
});
