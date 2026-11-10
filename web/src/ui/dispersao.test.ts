import assert from "node:assert/strict";
import { test } from "node:test";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { toHtml } from "../lib/vdom.ts";
import { chartFrame } from "./chart-frame.ts";
import { cloudChart } from "./charts.ts";
import { buildModel } from "./model.ts";
import { dots, multipleAxis, scatterFrame } from "./scatter.ts";

test("eixo de múltiplos: piso e teto em ticks inteiros, ignora ≤ 0", () => {
  assert.deepEqual(multipleAxis([15, 148]), { ticks: [10, 20, 30, 50, 100, 150], min: 10, max: 150 });
  assert.deepEqual(multipleAxis([]), { ticks: [10, 100], min: 10, max: 100 });
  assert.equal(multipleAxis([-5, 0, 24]).min, 20);
});

const daily = {
  meta: { generated: "2026-11-09", marketSnapshot: "2026-11-06", totalMarketCapT: 1 },
  companies: [
    { ticker: "AAA", price: 10, marketCapB: 500, weight: 50, cds: null },
    { ticker: "BBB", price: 10, marketCapB: 900, weight: 50, cds: null },
  ],
} as unknown as DailyFile;
const co = (t: string, name: string, annual: object) => ({ ticker: t, name, annual, revHistory: [1], niHistory: [1], fcfAnnual: [1], capex: [1], valuation: {} });
const mk = (segments?: unknown) =>
  ({
    meta: {},
    companies: [co("AAA", "Alfa <script>x</script>", { revenueB: 100, revGrowth: 20 }), co("BBB", "Beta", {})],
    derived: { balanceQ2_2026: {}, fcfTTM: {}, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {}, cloudSegmentsQ2_2026: segments },
  }) as unknown as FundamentalsFile;

test("nuvem/IA: segmentos viram barras com crescimento na tabela; sem a fonte, lista vazia", () => {
  const m = buildModel(daily, mk([{ n: "Seg <b>x</b>", v: 89, g: 117 }, { n: "Outro", v: 42.2, g: 37 }]));
  const c = cloudChart(m);
  assert.deepEqual(c.data.map((d) => d.value), [89, 42.2]);
  assert.deepEqual(c.data[0]?.cells, ["+117%"]);
  assert.ok(c.summary.includes("Maior crescimento a/a: Seg"));
  const html = toHtml(chartFrame(c));
  assert.ok(!html.includes("<b>x") && html.includes("&lt;b&gt;"));
  assert.deepEqual(buildModel(daily, mk()).cloudSegments, []);
});

test("dispersão: pontos sem dado ficam fora do SVG mas na tabela; texto escapado; sem NaN", () => {
  const m = buildModel(daily, mk());
  const d = dots(m);
  assert.equal(d.length, 2);
  const html = toHtml(scatterFrame(m));
  assert.ok(!html.includes("<script>x") && html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("NaN") && !html.includes("Infinity") && !html.includes("undefined"));
  assert.ok(html.includes("Sem dado para o gráfico") || html.includes("Sem dados válidos"));
  assert.ok(html.includes("<table"));
});
