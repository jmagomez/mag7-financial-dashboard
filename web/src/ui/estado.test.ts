import assert from "node:assert/strict";
import { test } from "node:test";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { parseRoute } from "../lib/router.ts";
import { toHtml } from "../lib/vdom.ts";
import { appView, staleNotice } from "./app.ts";
import { buildModel } from "./model.ts";

// Fixture mínima e sintética (não depende do data.json do dia).
const daily = {
  meta: { generated: "2026-11-09", marketSnapshot: "2026-11-06", totalMarketCapT: 1 },
  companies: [{ ticker: "AAA", price: 10, marketCapB: 500, weight: 100, cds: 80 }],
} as unknown as DailyFile;
const fund = {
  meta: { annualLabel: "FY2025", quarterLabel: "Q2 2026" },
  companies: [{ ticker: "AAA", name: "Alfa", rating: { sp: "AA", moody: "Aa1" }, annual: { revenueB: 100, revGrowth: 5 }, quarter: {}, revHistory: [1, 2, 3, 4, 5], niHistory: [1, 2, 3, 4, 5], fcfAnnual: [1], capex: [10], valuation: {} }],
  derived: { balanceQ2_2026: {}, fcfTTM: {}, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {} },
} as unknown as FundamentalsFile;

test("estado obsoleto: aviso com a data do arquivo exibido; sem falha, nenhum aviso; texto sempre escapado", () => {

  const model = buildModel(daily, fund);
  const ok = { status: "ready", model } as const;
  assert.equal(staleNotice(ok), null);
  assert.equal(staleNotice({ status: "loading" }), null);
  const bad = { status: "ready", model, refreshError: "data.json: HTTP 503 <img src=x>" } as const;
  const n = staleNotice(bad);
  assert.equal(n?.level, "stale");
  assert.ok(n?.text.includes("exibindo o arquivo de 09/11/2026"));
  const html = toHtml(appView(bad, parseRoute("#ind")));
  assert.ok(html.includes("obsoleto · não foi possível atualizar"));
  assert.ok(!html.includes("<img"), "o erro entra como texto, nunca como HTML");
  assert.ok(!toHtml(appView(ok, parseRoute("#ind"))).includes("obsoleto"));
});

test("cabeçalho traz o chip de preços e o de resultados trimestrais", () => {
  const html = toHtml(appView({ status: "ready", model: buildModel(daily, fund) }, parseRoute("#ind")));
  assert.ok(html.includes("preços de 06/11"));
  assert.ok(html.includes("atenção · resultados de Q2 2026 · 132 d após o fim do trimestre")); // 30/06 → 09/11
});
