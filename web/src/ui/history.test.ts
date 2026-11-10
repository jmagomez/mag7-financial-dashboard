import assert from "node:assert/strict";
import { test } from "node:test";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { toHtml } from "../lib/vdom.ts";
import { briefCard, fmtDateFull } from "./brief.ts";
import { historySpec } from "./history.ts";
import { lineFrame } from "./line-frame.ts";
import { buildModel } from "./model.ts";

const mk = (over: Partial<DailyFile["meta"]> = {}, fcf = [1, 2, 3], ni = [1, 2, 3, 4]): { d: DailyFile; f: FundamentalsFile } => ({
  d: {
    meta: { generated: "2026-11-09", marketSnapshot: "2026-11-06", totalMarketCapT: 1, ...over },
    companies: [
      { ticker: "AAA", price: 1, marketCapB: 1, weight: 1, cds: null },
      { ticker: "BBB", price: 1, marketCapB: 1, weight: 1, cds: null },
    ] as unknown as DailyFile["companies"],
  },
  f: {
    meta: { historyLabels: ["T1", "T2", "T3", "T4"], fcfLabels: ["A", "B", "C"] },
    companies: [
      { ticker: "AAA", name: "Alfa", revHistory: [10, 20, 0, 40], niHistory: ni, fcfAnnual: fcf, capex: [1], valuation: {} },
      { ticker: "BBB", name: "Beta", revHistory: [10, 10, 10, 10], niHistory: [5, 5, 5, -5], fcfAnnual: [5, 5, 5], capex: [1], valuation: {} },
    ],
    derived: { balanceQ2_2026: {}, fcfTTM: {}, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {} },
  } as unknown as FundamentalsFile,
});

const BRIEF = {
  headline: "Manchete <script>alert(1)</script>",
  bullets: ["ponto <img src=x onerror=alert(1)>", "outro"],
  sources: [
    { label: "Boa", url: "https://exemplo.com/a" },
    { label: "Ruim <b>", url: "javascript:alert(1)" },
    { label: "Http", url: "http://exemplo.com" },
  ],
  date: "2026-11-09",
};

test("briefing: texto injetado é escapado e só fonte https vira link", () => {
  const html = toHtml(briefCard(BRIEF, "2026-11-09"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("<b>"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.equal((html.match(/<a /g) ?? []).length, 1);
  assert.ok(html.includes('href="https://exemplo.com/a"'));
  assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes("Ruim &lt;b&gt;") && html.includes("Http")); // rótulo permanece, sem link
  assert.ok(html.includes("Briefing de 09/11/2026"));
  assert.equal(fmtDateFull("2026-11-09"), "09/11/2026");
});

test("briefing antigo ganha chip de atenção/defasado", () => {
  assert.ok(toHtml(briefCard({ ...BRIEF, date: "2026-10-01" }, "2026-11-09")).includes("defasado"));
});

test("modelo carrega o briefing e os rótulos; ausência de briefing é null", () => {
  const a = mk({ dailyBrief: BRIEF });
  const m = buildModel(a.d, a.f);
  assert.equal(m.brief?.sources.length, 3);
  assert.deepEqual(m.periods, ["T1", "T2", "T3", "T4"]);
  assert.equal(buildModel(mk().d, mk().f).brief, null);
});

test("série com tamanho diferente dos rótulos falha alto", () => {
  const a = mk({}, [1, 2, 3], [1, 2, 3]);
  assert.throws(() => buildModel(a.d, a.f), /AAA: lucro líquido tem 3 pontos/);
  const b = mk({}, [1, 2], [1, 2, 3, 4]);
  assert.throws(() => buildModel(b.d, b.f), /FCF anual tem 2 pontos/);
});

test("margem: receita zero vira n/d (não 0) e aparece na tabela", () => {
  const a = mk();
  const spec = historySpec(buildModel(a.d, a.f), "margin");
  assert.deepEqual(spec.series[0]?.values, [10, 10, null, 10]);
  assert.deepEqual(spec.series[1]?.values, [50, 50, 50, -50]);
  const html = toHtml(lineFrame(spec));
  assert.ok(html.includes("n/d"));
  assert.ok(html.includes("-50,0%"));
});

test("métricas: receita, lucro e FCF usam os rótulos certos", () => {
  const a = mk();
  const m = buildModel(a.d, a.f);
  assert.deepEqual(historySpec(m, "fcf").periods, ["A", "B", "C"]);
  assert.deepEqual(historySpec(m, "rev").periods, ["T1", "T2", "T3", "T4"]);
  assert.ok(historySpec(m, "rev").summary.includes("Maior valor em T4: AAA, 40,0 US$ bi"));
});

test("LineFrame: resumo, SVG rotulado, uma linha por empresa e tabela completa; ticker malicioso escapado", () => {
  const a = mk();
  const spec = historySpec(buildModel(a.d, a.f), "ni");
  spec.series[0]!.label = "<script>x</script>";
  const html = toHtml(lineFrame(spec));
  assert.ok(html.includes('role="img"') && html.includes("<table>"));
  assert.ok(!html.includes("<script>x"));
  assert.equal((html.match(/<th scope="row">/g) ?? []).length, 2);
  assert.equal((html.match(/class="endl"/g) ?? []).length, 2);
  assert.ok(!html.includes("NaN") && !html.includes("Infinity"));
});
