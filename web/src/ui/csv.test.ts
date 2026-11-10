import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell, toCsv } from "../lib/csv.ts";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { toHtml } from "../lib/vdom.ts";
import { appView } from "./app.ts";
import { csvFilename, csvTable } from "./csv.ts";
import { buildModel } from "./model.ts";
import { parseRoute } from "../lib/router.ts";

test("célula CSV: vazio para null/NaN, aspas dobradas, quebra de linha entre aspas", () => {
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
  assert.equal(csvCell(Number.NaN), "");
  assert.equal(csvCell(Infinity), "");
  assert.equal(csvCell(-3.5), "-3.5"); // número negativo não é "fórmula"
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("x\ny"), '"x\ny"');
});

test("célula CSV: texto que parece fórmula ganha apóstrofo (injeção de fórmula no Excel)", () => {
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell("-1+2"), "'-1+2");
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(csvCell("normal"), "normal");
});

test("toCsv: BOM no início e linhas separadas por \\n", () => {
  assert.equal(toCsv([["a", 1], ["b", null]]), "﻿a,1\nb,");
});

const daily = {
  meta: { generated: "2026-11-09", marketSnapshot: "2026-11-06", totalMarketCapT: 1 },
  companies: [{ ticker: "AAA", price: 10, marketCapB: 500, weight: 100, cds: 80 }],
} as unknown as DailyFile;
const fund = {
  meta: { annualLabel: "FY2025", quarterLabel: "Q2 2026" },
  companies: [{ ticker: "AAA", name: "=Alfa", rating: { sp: "AA", moody: "Aa1" }, annual: { revenueB: 100, revGrowth: 5 }, quarter: {}, revHistory: [1, 2, 3, 4, 5], niHistory: [1.04, 2, 3, 4.04, 5], fcfAnnual: [1], capex: [10], valuation: { divYield: 0.5 } }],
  derived: { balanceQ2_2026: {}, fcfTTM: {}, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {} },
} as unknown as FundamentalsFile;

test("tabela de exportação: cabeçalho e linhas com o mesmo número de colunas, rótulos do período e TTM arredondado", () => {
  const m = buildModel(daily, fund);
  const [header, row] = csvTable(m);
  assert.ok(header && row);
  assert.equal(header.length, row.length);
  assert.equal(header.length, 39);
  assert.ok(header.includes("Rev_FY2025_B") && header.includes("OpInc_Q2-2026_B") && header.includes("CapEx_FY2025_B"));
  assert.equal(row[header.indexOf("TTM_NI_B")], 14); // 2 + 3 + 4,04 + 5 = 14,04 → 14,0
  assert.equal(row[header.indexOf("DivYield_pct")], 0.5);
  assert.equal(row[header.indexOf("FCFYield_recalculado")], "nao");
  assert.equal(row[header.indexOf("Rating_SP")], "AA");
  assert.equal(row[header.indexOf("Snapshot_mercado")], "2026-11-06");
  assert.equal(csvFilename(m), "mag7_indicadores_2026-11-09.csv");
  assert.ok(toCsv(csvTable(m)).includes("'=Alfa")); // nome que começa com "=" é neutralizado
});

test("botão de exportação só aparece com os dados carregados e não usa handler inline", () => {
  const m = buildModel(daily, fund);
  const ready = toHtml(appView({ status: "ready", model: m }, parseRoute("#ind")));
  assert.ok(ready.includes('id="csv-btn"') && ready.includes('type="button"'));
  assert.ok(!ready.includes("onclick"));
  assert.ok(!toHtml(appView({ status: "loading" }, parseRoute("#ind"))).includes("csv-btn"));
});
