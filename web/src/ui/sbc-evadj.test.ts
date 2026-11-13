import assert from "node:assert/strict";
import { test } from "node:test";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { toHtml } from "../lib/vdom.ts";
import { footerBlock } from "./credit.ts";
import { evAdjustedBlock } from "./ev-ajustado.ts";
import { buildModel } from "./model.ts";
import { sbcBlock } from "./sbc.ts";

const S = { label: "SEC <b>x</b>", url: "https://data.sec.gov/x" };
const daily = {
  meta: { generated: "2026-11-13", marketSnapshot: "2026-11-12", totalMarketCapT: 1 },
  companies: [
    { ticker: "AAA", price: 10, marketCapB: 1000, weight: 50, cds: null },
    { ticker: "BBB", price: 10, marketCapB: 500, weight: 50, cds: null },
  ],
} as unknown as DailyFile;
const co = (ticker: string, name: string) => ({ ticker, name, rating: { sp: "AA", moody: "Aa2" }, annual: {}, quarter: {}, revHistory: [1, 1, 1, 1], niHistory: [1, 1, 1, 1], fcfAnnual: [1], capex: [1], valuation: {} });
const fund = (extra: Record<string, unknown>) =>
  ({
    meta: { annualLabel: "FY2025", quarterLabel: "Q2 2026" },
    companies: [co("AAA", "Alfa <i>"), co("BBB", "Beta")],
    derived: { balanceQ2_2026: { AAA: { cash: 50, debt: 100 }, BBB: { cash: 10, debt: 10 } }, fcfTTM: { AAA: { value: 40, asOf: "2026-06-30", tier: "primary", source: { label: "Release", url: "https://exemplo.com/r" } }, BBB: { value: -5, asOf: "2026-06-30", tier: "primary", source: { label: "Release", url: "https://exemplo.com/r" } } } as never, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {}, ...extra },
  }) as unknown as FundamentalsFile;
const sbc = { AAA: { valueB: 12.5, asOf: "2026-06-30", parts: "FY 1 + 2 − 3", source: S } };
const ev = { AAA: { opLeaseB: 20, finLeaseB: 5, nciB: 0, asOf: "2026-06-30", source: S } };

test("sem os blocos as seções somem e o rodapé segue", () => {
  const m = buildModel(daily, fund({}));
  assert.equal(sbcBlock(m), null);
  assert.equal(evAdjustedBlock(m), null);
  const html = toHtml(footerBlock(m));
  assert.ok(!html.includes("FCF após remuneração") && !html.includes("EV ajustado"));
});

test("FCF após SBC: números pt-BR, n/d da empresa sem dado, texto escapado e seção no rodapé", () => {
  const m = buildModel(daily, fund({ sbcTTM: sbc, sbcTTMNote: "Nota <script>x</script>" }));
  const html = toHtml(sbcBlock(m)!);
  assert.ok(html.includes("27,5") && html.includes("31,3%") && html.includes("2,8%"));
  assert.ok(html.includes("Sem dado: BBB."));
  assert.ok(html.includes("Alfa &lt;i&gt;") && !html.includes("<i>") && !html.includes("<script>"));
  assert.ok(toHtml(footerBlock(m)).includes("FCF após remuneração em ações"));
});

test("EV ajustado: EV = 1000 − (50 − 100) = 1050; ajustado 1.075 (+2,4%); empresa sem entrada em n/d; link só https", () => {
  const m = buildModel(daily, fund({ evAdjust: ev, evAdjustNote: "Nota" }));
  const html = toHtml(evAdjustedBlock(m)!);
  assert.ok(html.includes("1.050") && html.includes("1.075") && html.includes("+2,4%"));
  assert.ok(html.includes("Sem dado confirmado (n/d): BBB."));
  assert.ok(html.includes('href="https://data.sec.gov/x"'));
  assert.ok(toHtml(footerBlock(m)).includes("EV ajustado (arrendamentos e minoritários)"));
  const bad = buildModel(daily, fund({ evAdjust: { AAA: { ...ev.AAA, source: { label: "x", url: "javascript:alert(1)" } } } }));
  assert.ok(!toHtml(evAdjustedBlock(bad)!).includes("javascript:"));
});
