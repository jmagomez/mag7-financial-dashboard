import assert from "node:assert/strict";
import { test } from "node:test";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { toHtml } from "../lib/vdom.ts";
import { impliedGrowthChart } from "./charts.ts";
import { footerBlock } from "./credit.ts";
import { buildModel } from "./model.ts";
import { waccBlock } from "./wacc.ts";

const S = { label: "Fonte <b>x</b>", url: "https://example.com/x" };
const wacc = (over: Record<string, unknown> = {}) => ({
  asOf: "2026-11-12",
  rfPct: 5,
  rfSource: S,
  erpPct: 4,
  erpAsOf: "2026-11-01",
  erpSource: { label: "ERP", url: "javascript:alert(1)" },
  taxPct: 21,
  ratingSpreadsPct: { AA: 0.55 },
  spreadsSource: S,
  betas: { AAA: { beta: 2, asOf: "2026-11-08", source: S } },
  note: "Nota <script>x</script>",
  ...over,
});
const daily = {
  meta: { generated: "2026-11-13", marketSnapshot: "2026-11-12", totalMarketCapT: 1 },
  companies: [{ ticker: "AAA", price: 10, marketCapB: 1000, weight: 100, cds: null }],
} as unknown as DailyFile;
const fund = (w?: unknown) =>
  ({
    meta: { annualLabel: "FY2025", quarterLabel: "Q2 2026" },
    companies: [{ ticker: "AAA", name: "Alfa <i>", rating: { sp: "AA", moody: "Aa2" }, annual: {}, quarter: {}, revHistory: [1, 1, 1, 1], niHistory: [1, 1, 1, 1], fcfAnnual: [1], capex: [1], valuation: {} }],
    derived: { balanceQ2_2026: { AAA: { cash: 50, debt: 100 } }, fcfTTM: { AAA: 40 }, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {}, dcfAssumptions: { waccPct: 9, terminalGrowthPct: 3, years: 10 }, ...(w === undefined ? {} : { waccInputs: w }) },
  }) as unknown as FundamentalsFile;

test("sem waccInputs (ou malformado) a seção some e o gráfico fala em WACC 9%", () => {
  for (const w of [undefined, { rfPct: 1 }]) {
    const m = buildModel(daily, fund(w));
    assert.equal(m.waccInputs, null);
    assert.equal(waccBlock(m), null);
    assert.ok(impliedGrowthChart(m).summary.includes("WACC 9%"));
    assert.ok(!toHtml(footerBlock(m)).includes("WACC por empresa (usado"));
  }
});

test("com waccInputs: tabela com os números, texto escapado, só link https, e o gráfico cita a faixa de WACC", () => {
  const m = buildModel(daily, fund(wacc()));
  assert.equal(m.wacc.length, 1);
  assert.equal(m.wacc[0]?.waccPct, 11.02);
  const html = toHtml(waccBlock(m)!);
  assert.ok(html.includes("11,02%") && html.includes("11,68%") && html.includes("1,67") && html.includes("Alfa &lt;i&gt;"));
  assert.ok(!html.includes("<script>") && !html.includes("<b>x") && !html.includes("javascript:"));
  assert.ok(html.includes('href="https://example.com/x"'));
  assert.ok(toHtml(footerBlock(m)).includes("WACC por empresa (usado no DCF reverso)"));
  assert.ok(impliedGrowthChart(m).summary.includes("WACC por empresa (11,0% a 11,0%)"));
});
