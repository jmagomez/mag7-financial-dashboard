import assert from "node:assert/strict";
import { test } from "node:test";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { parseRoute, valHash } from "../lib/router.ts";
import { toHtml } from "../lib/vdom.ts";
import { divYieldChart } from "./charts.ts";
import { buildModel } from "./model.ts";
import { sortValuation, valuationTable } from "./valuation.ts";

const daily = {
  meta: { generated: "2026-11-09", marketSnapshot: "2026-11-06", totalMarketCapT: 1 },
  companies: [
    { ticker: "AAA", price: 10, marketCapB: 500, weight: 50, cds: null },
    { ticker: "BBB", price: 10, marketCapB: 900, weight: 50, cds: null },
  ],
} as unknown as DailyFile;
const co = (t: string, name: string, valuation: object) => ({ ticker: t, name, revHistory: [1], niHistory: [1], fcfAnnual: [1], capex: [1], valuation });
const fund = {
  meta: {},
  companies: [co("AAA", "Alfa <script>x</script>", { divYield: 1.25, grossMargin: 47, fcfYield: -2, fcfB: -5 }), co("BBB", "Beta", { divYield: 0 })],
  derived: { balanceQ2_2026: {}, fcfTTM: {}, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {} },
} as unknown as FundamentalsFile;

test("dividend yield: zero e ausente viram n/d, não barra de zero; resumo cita o maior", () => {
  const c = divYieldChart(buildModel(daily, fund));
  assert.equal(c.data.find((d) => d.label === "Beta")?.value, null);
  assert.equal(c.data.find((d) => d.label.startsWith("Alfa"))?.value, 1.25);
  assert.ok(c.summary.includes("1,25"));
});

test("tabela de valuation: ordenada por valor de mercado, sem dividendo e sem dado viram —, negativos marcados, texto escapado", () => {
  const html = toHtml(valuationTable(parseRoute("#val"), buildModel(daily, fund)));
  assert.ok(html.indexOf("Beta") < html.indexOf("Alfa")); // 900 antes de 500
  assert.ok(html.includes("1,25%") && html.includes("47,0%") && html.includes("-2,0%"));
  assert.ok(html.includes('class="num neg"'));
  assert.ok(html.includes("—"));
  assert.ok(!html.includes("<script>x") && html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("NaN") && !html.includes("undefined"));
});

test("rota da tabela de valuation: padrão, ida e volta, lixo ignorado, só vale na aba val", () => {
  const d = parseRoute("#val");
  assert.deepEqual([d.valSort, d.valDir], ["marketCapB", -1]);
  const r = parseRoute("#val-evEbitda-asc");
  assert.deepEqual([r.tab, r.valSort, r.valDir], ["val", "evEbitda", 1]);
  assert.equal(valHash("marketCapB", -1), "#val");
  assert.equal(valHash("pe", 1), "#val-pe-asc");
  assert.equal(valHash("fcfYield", -1), "#val-fcfYield");
  assert.equal(parseRoute("#val-<script>-x").valSort, "marketCapB");
  assert.equal(parseRoute("#ind-pe-asc").valSort, "marketCapB");
  for (const k of ["name", "pe", "peCore", "peFwd", "evEbitda", "divYield", "fcfYield", "fcfB", "grossMargin", "net", "evSales"] as const)
    for (const dir of [1, -1] as const) {
      const x = parseRoute(valHash(k, dir));
      assert.deepEqual([x.valSort, x.valDir], [k, dir]);
    }
});

test("ordenação da valuation: sem dado (null, dividendo zero) vai ao fim nas duas direções; nome em pt-BR; desempate por ticker", () => {
  const m = buildModel(daily, fund);
  const tick = (k: Parameters<typeof sortValuation>[1], dir: 1 | -1) => sortValuation(m, k, dir).map((c) => c.ticker);
  assert.deepEqual(tick("marketCapB", -1), ["BBB", "AAA"]);
  assert.deepEqual(tick("marketCapB", 1), ["AAA", "BBB"]);
  // AAA tem dividendo 1,25; BBB tem 0 (= sem dado): BBB fica por último mesmo em ordem crescente e decrescente
  assert.deepEqual(tick("divYield", 1), ["AAA", "BBB"]);
  assert.deepEqual(tick("divYield", -1), ["AAA", "BBB"]);
  assert.deepEqual(tick("name", 1), ["AAA", "BBB"]);
  assert.deepEqual(tick("name", -1), ["BBB", "AAA"]);
  assert.deepEqual(tick("pe", -1), ["AAA", "BBB"]); // ambos sem dado: desempate estável por ticker
});

test("cabeçalhos da valuation: links reais, aria-sort só na coluna ativa, clique na ativa inverte", () => {
  const m = buildModel(daily, fund);
  const html = toHtml(valuationTable(parseRoute("#val-pe-asc"), m));
  assert.equal((html.match(/aria-sort="ascending"/g) ?? []).length, 1);
  assert.equal((html.match(/aria-sort="none"/g) ?? []).length, 11);
  assert.ok(html.includes('href="#val-pe"')); // ativa e crescente → próximo clique: decrescente
  assert.ok(html.includes('href="#val-fcfYield"') && html.includes('href="#val"'));
  assert.ok(html.includes("P/E TTM ▲"));
});
