import assert from "node:assert/strict";
import { test } from "node:test";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { toHtml } from "../lib/vdom.ts";
import { footerBlock } from "./credit.ts";
import { buildModel } from "./model.ts";
import { sensitivityBlock } from "./sensibilidade.ts";

const daily = {
  meta: { generated: "2026-11-13", marketSnapshot: "2026-11-12", totalMarketCapT: 1 },
  companies: [{ ticker: "AAA", price: 10, marketCapB: 1000, weight: 100, cds: null }],
} as unknown as DailyFile;
const fund = (balance: unknown) =>
  ({
    meta: { annualLabel: "FY2025", quarterLabel: "Q2 2026" },
    companies: [{ ticker: "AAA", name: "Alfa <i>", rating: { sp: "AA", moody: "Aa2" }, annual: {}, quarter: {}, revHistory: [1, 1, 1, 1], niHistory: [1, 1, 1, 1], fcfAnnual: [1], capex: [1], valuation: {} }],
    derived: { balanceQ2_2026: balance, fcfTTM: { AAA: 40 }, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {}, dcfAssumptions: { waccPct: 9, terminalGrowthPct: 3, years: 10 } },
  }) as unknown as FundamentalsFile;

test("sem balanço a seção some e o rodapé segue", () => {
  const m = buildModel(daily, fund({}));
  assert.equal(sensitivityBlock(m), null);
  assert.ok(!toHtml(footerBlock(m)).includes("Sensibilidade do DCF reverso"));
});

test("com balanço: 5 colunas de passo, números formatados em pt-BR, nome escapado e a seção entra no rodapé", () => {
  const m = buildModel(daily, fund({ AAA: { cash: 50, debt: 100 } }));
  const html = toHtml(sensitivityBlock(m)!);
  for (const t of ["−2 p.p.", "−1 p.p.", "WACC central", "+1 p.p.", "+2 p.p."]) assert.ok(html.includes(t), t);
  assert.ok(html.includes("9,00%"));
  assert.ok(html.includes("Alfa &lt;i&gt;") && !html.includes("<i>"));
  assert.equal((html.match(/<tr>/g) ?? []).length, 2); // cabeçalho + 1 empresa
  assert.ok(toHtml(footerBlock(m)).includes("Sensibilidade do DCF reverso ao WACC"));
});
