import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProvenance } from "../lib/provenance.ts";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { toHtml } from "../lib/vdom.ts";
import { footerBlock } from "./credit.ts";
import { buildModel } from "./model.ts";
import { provenanceBlock } from "./provenance.ts";

const prov = (anchorDate = "2026-08-27", source = "Preços <img src=x> (agregador)") => ({
  prices: { tier: "secondary", asOf: "2026-11-06", source },
  marketCapB: { tier: "derived", asOf: "2026-11-06", method: "preço × ações implícitas", anchor: { date: anchorDate, source: "Slickcharts" } },
  weight: { tier: "derived", asOf: "2026-11-06", method: "market cap ÷ total" },
  cds: { AAA: { tier: "primary", asOf: "2026-11-05" } },
});
const daily = (provenance?: unknown) =>
  ({
    meta: { generated: "2026-11-09", marketSnapshot: "2026-11-06", totalMarketCapT: 1, ...(provenance === undefined ? {} : { provenance }) },
    companies: [{ ticker: "AAA", price: 10, marketCapB: 500, weight: 100, cds: 80 }],
  }) as unknown as DailyFile;
const fund = {
  meta: { annualLabel: "FY2025", quarterLabel: "Q2 2026" },
  companies: [{ ticker: "AAA", name: "Alfa", rating: { sp: "AA", moody: "Aa1" }, annual: { revenueB: 100, revGrowth: 5 }, quarter: {}, revHistory: [1, 2, 3, 4, 5], niHistory: [1, 2, 3, 4, 5], fcfAnnual: [1], capex: [10], valuation: {} }],
  derived: { balanceQ2_2026: {}, fcfTTM: {}, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {} },
} as unknown as FundamentalsFile;

test("parseProvenance: aceita o bloco válido e rejeita nível, data ou grupo inválidos (sem quebrar o painel)", () => {
  assert.equal(parseProvenance(prov())?.cds.AAA?.tier, "primary");
  assert.equal(parseProvenance(undefined), null);
  assert.equal(parseProvenance("x"), null);
  assert.equal(parseProvenance({ ...prov(), prices: { tier: "ouro", asOf: "2026-11-06" } }), null);
  assert.equal(parseProvenance({ ...prov(), weight: undefined }), null);
  assert.equal(parseProvenance({ ...prov(), cds: { AAA: { tier: "primary", asOf: "ontem" } } }), null);
  const semAncora = parseProvenance({ ...prov(), marketCapB: { tier: "derived", asOf: "2026-11-06", anchor: { date: "ontem", source: "x" } } });
  assert.equal(semAncora?.marketCapB.anchor, undefined); // âncora malformada é descartada, o resto segue
});

test("sem meta.provenance (ou malformada) a seção não aparece e o rodapé segue", () => {
  for (const raw of [undefined, { prices: 1 }]) {
    const m = buildModel(daily(raw), fund);
    assert.equal(m.provenance, null);
    assert.equal(provenanceBlock(m), null);
    assert.ok(!toHtml(footerBlock(m)).includes("Proveniência dos números"));
  }
});

test("com proveniência: tabela com nível em palavra, data e fonte; texto sempre escapado; aparece no rodapé", () => {
  const m = buildModel(daily(prov()), fund);
  const html = toHtml(provenanceBlock(m)!);
  assert.ok(html.includes("Proveniência dos números"));
  assert.ok(html.includes("secundária (agregador ou imprensa)") && html.includes("derivada (calculada)") && html.includes("primária (emissor, bolsa ou SEC)"));
  assert.ok(html.includes("06/11/2026") && html.includes("CDS Alfa") && html.includes("05/11/2026"));
  assert.ok(!html.includes("<img"), "a fonte entra como texto, nunca como HTML");
  assert.ok(toHtml(footerBlock(m)).includes("Proveniência dos números"));
});

test("âncora das ações: dentro de 90 d é atual; acima disso pede reancoragem (idade por meta.generated)", () => {
  const novo = toHtml(provenanceBlock(buildModel(daily(prov("2026-08-27")), fund))!); // 74 d
  assert.ok(novo.includes("há 74 d") && novo.includes("atual · dentro do limite de 90 d") && !novo.includes("reancorar"));
  const velho = toHtml(provenanceBlock(buildModel(daily(prov("2026-07-01")), fund))!); // 131 d
  assert.ok(velho.includes("há 131 d") && velho.includes("defasada · reancorar"));
  const semAncora = toHtml(provenanceBlock(buildModel(daily({ ...prov(), marketCapB: { tier: "derived", asOf: "2026-11-06" } }), fund))!);
  assert.ok(semAncora.includes("Sem âncora das ações implícitas informada"));
});
