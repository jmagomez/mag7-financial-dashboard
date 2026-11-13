import assert from "node:assert/strict";
import { test } from "node:test";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { toHtml } from "../lib/vdom.ts";
import { footerBlock } from "./credit.ts";
import { buildModel } from "./model.ts";
import { QUALITY_ROWS, qualityBlock } from "./qualidade.ts";

const daily = {
  meta: { generated: "2026-11-13", marketSnapshot: "2026-11-12", totalMarketCapT: 1 },
  companies: [{ ticker: "AAA", price: 10, marketCapB: 500, weight: 100, cds: 80 }],
} as unknown as DailyFile;
const fund = {
  meta: { annualLabel: "FY2025", quarterLabel: "Q2 2026" },
  companies: [{ ticker: "AAA", name: "Alfa", rating: { sp: "AA", moody: "Aa1" }, annual: {}, quarter: {}, revHistory: [1, 2, 3, 4, 5], niHistory: [1, 2, 3, 4, 5], fcfAnnual: [1], capex: [10], valuation: {} }],
  derived: { balanceQ2_2026: {}, fcfTTM: {}, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {} },
} as unknown as FundamentalsFile;
const q = (over: Record<string, unknown> = {}) => ({ pricesTier: "secondary", cdsCount: 5, cdsAvgAgeDays: 12.4, cdsMaxAgeDays: 40, cdsStale: 1, ...over });
const day = (n: number) => `2026-11-${String(n).padStart(2, "0")}`;

test("sem snapshot com quality (ou sem snapshots) a seção some e o rodapé segue", () => {
  for (const snaps of [undefined, { snapshots: [{ date: "2026-11-10", cds: {} }] }, { snapshots: [{ date: "2026-11-10", cds: {}, quality: { pricesTier: "x" } }] }]) {
    const m = buildModel(daily, fund, snaps);
    assert.equal(qualityBlock(m), null);
    assert.ok(!toHtml(footerBlock(m)).includes("Qualidade dos dados ao longo do tempo"));
  }
});

test("com quality: tabela do mais novo ao mais antigo, números formatados, defasados em destaque, limite de linhas e nota de início", () => {
  const snaps = { snapshots: Array.from({ length: 12 }, (_, i) => ({ date: day(i + 1), cds: {}, quality: q({ cdsStale: i === 11 ? 2 : 0, cdsAvgAgeDays: i === 11 ? 12.4 : 3 }) })) };
  const m = buildModel(daily, fund, snaps);
  const html = toHtml(qualityBlock(m)!);
  assert.equal((html.match(/<tr>/g) ?? []).length, QUALITY_ROWS + 1); // cabeçalho + 10 linhas
  assert.ok(html.indexOf("12/11/2026") < html.indexOf("03/11/2026"));
  assert.ok(html.includes("12,4") && html.includes("secundária") && html.includes("chip-stale"));
  assert.ok(html.includes("A série começa em 01/11/2026"));
  assert.ok(toHtml(footerBlock(m)).includes("Qualidade dos dados ao longo do tempo"));
});
