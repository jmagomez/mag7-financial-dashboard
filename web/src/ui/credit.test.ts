import assert from "node:assert/strict";
import { test } from "node:test";
import { capexIntensity, lastChange, parseSnapshots } from "../lib/credit.ts";
import { logAxis } from "../lib/history.ts";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { toHtml } from "../lib/vdom.ts";
import { capexOcfChart } from "./charts.ts";
import { capexSpec, cdsLogBlock, footerBlock, ratingsTable, trendBlock, trendNotes } from "./credit.ts";
import { lineFrame } from "./line-frame.ts";
import { buildModel } from "./model.ts";

const daily = {
  meta: {
    generated: "2026-11-09",
    marketSnapshot: "2026-11-06",
    totalMarketCapT: 1,
    cdsAsOf: { AAA: "2026-11-06", REF: "2026-07-01" },
    cdsRef: [{ ticker: "REF", name: "Ref", cds: 1000, rating: { sp: "B", moody: "B2" } }],
    cdsLog: [
      { date: "2026-11-01", text: "primeiro <b>x</b>" },
      { date: "2026-11-05", text: "segundo" },
    ],
  },
  companies: [{ ticker: "AAA", price: 1, marketCapB: 1, weight: 1, cds: 80 }],
} as unknown as DailyFile;
const fund = {
  meta: {
    capexLabels: ["FY1", "FY2"],
    creditNotes: ["nota <i>c</i>"],
    notes: ["met <script>x</script>"],
  },
  sources: [
    { label: "ok", url: "https://a.example/x" },
    { label: "ruim", url: "javascript:alert(1)" },
  ],
  companies: [
    { ticker: "AAA", name: "Alfa", rating: { sp: "AA", moody: "Aa1" }, annual: { revenueB: 200 }, revHistory: [1], niHistory: [1], fcfAnnual: [1], capex: [10, 40], valuation: {} },
  ],
  derived: { balanceQ2_2026: {}, fcfTTM: {}, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {} },
} as unknown as FundamentalsFile;
const SNAPS = {
  snapshots: [
    { date: "2026-11-05", prices: {}, cds: { AAA: 80, REF: 1000 } },
    { date: "2026-11-02", cds: { AAA: 70, REF: 1000 } },
    { date: "2026-11-01", note: "sem cds" },
    { date: "lixo", cds: { AAA: 1 } },
    { date: "2026-11-06", cds: { AAA: 90, REF: "x" } },
  ],
};

test("intensidade de CapEx: fórmula do painel atual e null sem receita válida", () => {
  assert.equal(capexIntensity([10, 40], 200), 20);
  assert.equal(capexIntensity([1, 3.2], 100), 3.2);
  assert.equal(capexIntensity([40], undefined), null);
  assert.equal(capexIntensity([40], 0), null);
  assert.equal(capexIntensity([], 100), null);
});

test("snapshots: ignora entradas inválidas, ordena por data, valor não numérico vira null", () => {
  const s = parseSnapshots(SNAPS);
  assert.deepEqual(s.map((x) => x.date), ["2026-11-02", "2026-11-05", "2026-11-06"]);
  assert.equal(s[2]?.cds.REF, null);
  assert.deepEqual(parseSnapshots(null), []);
  assert.deepEqual(parseSnapshots({ snapshots: "x" }), []);
});

test("última variação só lista quem mudou e tem valor nos dois dias", () => {
  const ch = lastChange(parseSnapshots(SNAPS), ["AAA", "REF"]);
  assert.deepEqual(ch, { from: "2026-11-05", to: "2026-11-06", moves: ["AAA 80 → 90 bps"] });
  assert.equal(lastChange([], ["AAA"]), null);
});

test("eixo log: piso 40, teto no próximo tick, ticks pedidos", () => {
  assert.deepEqual(logAxis([60, 1155]), { ticks: [50, 100, 200, 500, 1000, 2000], min: 40, max: 2000 });
  assert.deepEqual(logAxis([]), { ticks: [50, 100], min: 40, max: 100 });
  assert.equal(logAxis([20, 30]).min, 20);
});

test("buildModel: capex com tamanho diferente dos rótulos falha alto", () => {
  const bad = { ...fund, meta: { ...fund.meta, capexLabels: ["A", "B", "C"] } } as FundamentalsFile;
  assert.throws(() => buildModel(daily, bad), /CapEx tem 2 pontos/);
});

test("tendência: sem snapshots mostra aviso; com poucos, aguarda; com dados, escala log e todas as séries", () => {
  assert.match(trendBlock(buildModel(daily, fund, null)).message ?? "", /indisponível/);
  assert.match(trendBlock(buildModel(daily, fund, { snapshots: [{ date: "2026-11-01", cds: { AAA: 1 } }] })).message ?? "", /Aguardando/);
  const m = buildModel(daily, fund, SNAPS);
  const t = trendBlock(m).spec;
  assert.ok(t);
  assert.equal(t.scale, "log");
  assert.deepEqual(t.series.map((s) => s.label), ["AAA", "REF"]);
  const semDados = buildModel(daily, { ...fund, companies: [...fund.companies] }, { snapshots: [{ date: "2026-11-01", cds: { REF: 5 } }, { date: "2026-11-02", cds: { REF: 6 } }] });
  assert.deepEqual(trendBlock(semDados).spec?.series.map((s) => s.label), ["REF"]); // AAA sem nenhum valor fica de fora
  const html = toHtml(lineFrame(t));
  assert.ok(html.includes("1.000") || html.includes("1000"));
  assert.ok(html.includes("<table"));
  assert.ok(trendNotes(m).length === 2);
});

test("log: valor ≤ 0 vira lacuna, não -Infinity no SVG", () => {
  const html = toHtml(lineFrame({ id: "x", title: "t", subtitle: "s", summary: "r", suffix: "", scale: "log", periods: ["a", "b"], series: [{ label: "Z", values: [0, 100] }] }));
  assert.ok(!html.includes("Infinity") && !html.includes("NaN"));
});

test("CapEx por ano usa os rótulos fiscais; CapEx÷OCF cita o limiar de 80%", () => {
  const m = buildModel(daily, fund);
  assert.deepEqual(capexSpec(m).periods, ["FY1", "FY2"]);
  assert.ok(capexOcfChart(m).summary.includes("80%"));
});

test("ratings, log, notas e fontes: texto injetado é escapado e só https vira link", () => {
  const m = buildModel(daily, fund, SNAPS);
  const html = toHtml(ratingsTable(m)) + toHtml(cdsLogBlock(m)) + toHtml(footerBlock(m));
  assert.ok(!html.includes("<script>x") && !html.includes("<b>x"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes('href="https://a.example/x"'));
  assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes("ruim"));
  assert.ok(html.indexOf("segundo") < html.indexOf("primeiro")); // mais recente primeiro
  assert.ok(html.includes("ref."));
  assert.ok(html.includes("defasado")); // REF com cotação de julho
});
