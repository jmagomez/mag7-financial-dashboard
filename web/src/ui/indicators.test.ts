import assert from "node:assert/strict";
import { test } from "node:test";
import { kpis, money, priceDeltas, sortRows, type IndRow } from "../lib/indicators.ts";
import { parseSnapshots } from "../lib/credit.ts";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { parseRoute } from "../lib/router.ts";
import { toHtml } from "../lib/vdom.ts";
import { comparisonTable, kpiBlock, periodCharts, periodNav } from "./indicators.ts";
import { buildModel } from "./model.ts";

const row = (t: string, o: Partial<IndRow> = {}): IndRow => ({
  ticker: t,
  name: `Emp ${t}`,
  color: null,
  price: 100,
  marketCapB: 500,
  annual: { revenueB: 100, netIncomeB: 20, netMargin: 20, revGrowth: 10, epsDiluted: 2, period: "FY", note: "nota" },
  quarter: { revenueB: 30, netIncomeB: 6, netMargin: 20, revGrowth: -2, epsNonGaap: 0.33, period: "Q", note: "nq" },
  ...o,
});

test("money: bilhões, trilhões e n/d", () => {
  assert.equal(money(999.4), "$999 bi");
  assert.equal(money(1000), "$1 tri");
  assert.equal(money(24123.456), "$24,12 tri");
  assert.equal(money(null), "n/d");
});

test("KPIs: soma por período, margem agregada = lucro ÷ receita; falta de dado vira n/d, nunca soma parcial", () => {
  const rows = [row("A"), row("B", { annual: { revenueB: 300, netIncomeB: 60 } })];
  const k = Object.fromEntries(kpis(rows, "annual").map((x) => [x.label, x.value]));
  assert.equal(k["Receita somada"], "$400 bi");
  assert.equal(k["Lucro líquido somado"], "$80 bi");
  assert.equal(k["Margem agregada"], "20,0%");
  assert.equal(k["Valor de mercado"], "$1 tri");
  const q = Object.fromEntries(kpis([row("A"), row("B", { quarter: {} })], "quarter").map((x) => [x.label, x.value]));
  assert.equal(q["Receita somada"], "n/d");
  assert.equal(q["Margem agregada"], "n/d");
  assert.equal(kpis([], "annual")[0]?.value, "n/d");
});

test("ordenação: numérica nos dois sentidos, por nome, nulos sempre no fim, empate estável, sem mutar", () => {
  const rows = [row("A", { marketCapB: 10 }), row("B", { marketCapB: 30 }), row("C", { marketCapB: 20 }), row("D", { marketCapB: 20 })];
  const input = rows.slice();
  assert.deepEqual(sortRows(rows, "marketCapB", -1, "annual").map((r) => r.ticker), ["B", "C", "D", "A"]);
  assert.deepEqual(sortRows(rows, "marketCapB", 1, "annual").map((r) => r.ticker), ["A", "C", "D", "B"]);
  assert.deepEqual(rows, input);
  const nul = [row("A"), row("B", { annual: { revenueB: 5 } }), row("C", { annual: {} })];
  assert.deepEqual(sortRows(nul, "revenueB", -1, "annual").map((r) => r.ticker), ["A", "B", "C"]);
  assert.deepEqual(sortRows(nul, "revenueB", 1, "annual").map((r) => r.ticker), ["B", "A", "C"]);
  assert.deepEqual(sortRows([row("A", { name: "Zeta" }), row("B", { name: "Árvore" }), row("C", { name: "Beta" })], "name", 1, "annual").map((r) => r.ticker), ["B", "C", "A"]);
  assert.deepEqual(sortRows(rows, "revGrowth", -1, "quarter").map((r) => r.ticker), ["A", "B", "C", "D"]); // todos -2: empate estável
});

test("Δ vs. pregão anterior: usa o penúltimo snapshot com preços quando o último é do dia; senão o próprio último", () => {
  const snaps = parseSnapshots({
    snapshots: [
      { date: "2026-11-04", prices: { A: 100, B: 50 } },
      { date: "2026-11-05", prices: { A: 110 } },
      { date: "2026-11-06", note: "sem preços" },
    ],
  });
  const rows = [row("A", { price: 121 }), row("B", { price: 55 })];
  const d = priceDeltas(rows, snaps, "2026-11-05"); // último com preços (05) já é do dia → compara com 04
  assert.equal(d.from, "2026-11-04");
  assert.ok(Math.abs((d.byTicker.A as number) - 21) < 1e-9);
  assert.ok(Math.abs((d.byTicker.B as number) - 10) < 1e-9);
  const atrasado = priceDeltas(rows, snaps, "2026-11-09"); // snapshot atrasado → compara com o último
  assert.equal(atrasado.from, "2026-11-05");
  assert.equal(atrasado.byTicker.B, null); // sem preço de B nesse dia
  assert.deepEqual(priceDeltas(rows, null, "2026-11-05"), { from: null, byTicker: { A: null, B: null } });
  assert.equal(priceDeltas(rows, snaps.slice(0, 1), "2026-11-05").from, null); // um só snapshot: sem referência
});

const daily = {
  meta: { generated: "2026-11-09", marketSnapshot: "2026-11-06", totalMarketCapT: 1 },
  companies: [{ ticker: "AAA", price: 10.5, marketCapB: 1000, weight: 100, cds: null }],
} as unknown as DailyFile;
const fund = {
  meta: { annualLabel: "FY2025", quarterLabel: "Q2 2026" },
  companies: [
    {
      ticker: "AAA",
      name: "Alfa <script>x</script>",
      revHistory: [1],
      niHistory: [1],
      fcfAnnual: [1],
      capex: [1],
      valuation: {},
      annual: { period: "FY <b>", revenueB: 100, revGrowth: -3.5, netIncomeB: 10, netMargin: 10, epsDiluted: 1.5, note: "nota <img src=x onerror=1>" },
      quarter: { revenueB: 25, revGrowth: 4, netIncomeB: 3, netMargin: 12, epsNonGaap: 0.33 },
    },
  ],
  derived: { balanceQ2_2026: {}, fcfTTM: {}, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {} },
} as unknown as FundamentalsFile;
const snapsRaw = { snapshots: [{ date: "2026-11-05", prices: { AAA: 10 } }, { date: "2026-11-06", prices: { AAA: 10.5 } }] };

test("tabela: cabeçalhos ordenáveis com aria-sort, sinal explícito, LPA ajustado com *, Δ com a data de referência", () => {
  const m = buildModel(daily, fund, snapsRaw);
  const html = toHtml(comparisonTable(parseRoute("#ind-quarter-revenueB-asc"), m));
  assert.ok(html.includes('aria-sort="ascending"'));
  assert.ok(html.includes('href="#ind-quarter-revenueB"')); // clicar na coluna ativa inverte para decrescente
  assert.ok(html.includes('href="#ind-quarter-netIncomeB"')); // outra coluna: começa decrescente
  assert.ok(html.includes("$0,33*"));
  assert.ok(html.includes("+4,0%"));
  assert.ok(html.includes("Δ vs. 05/11"));
  assert.ok(html.includes("+5,00%")); // 10,5 / 10 − 1
  const anual = toHtml(comparisonTable(parseRoute("#ind"), m));
  assert.ok(anual.includes("-3,5%") && anual.includes("$1,50") && anual.includes("$10,50"));
  assert.ok(!toHtml(comparisonTable(parseRoute("#ind"), buildModel(daily, fund, null))).includes("Δ vs."));
});

test("tabela, KPIs e seletor: texto injetado é escapado e o período aparece no controle", () => {
  const m = buildModel(daily, fund, snapsRaw);
  const html = toHtml(comparisonTable(parseRoute("#ind"), m)) + toHtml(kpiBlock(m, "annual")) + toHtml(periodNav(parseRoute("#ind"), m));
  assert.ok(!html.includes("<script>x") && !html.includes("<img") && !html.includes("FY <b>"));
  assert.ok(html.includes("&lt;script&gt;") && html.includes("&lt;img"));
  assert.ok(html.includes('aria-current="page"') && html.includes("Ano fiscal · FY2025") && html.includes("Trimestre · Q2 2026"));
  assert.ok(html.includes("Último ano fiscal"));
});

test("gráficos do período: trocam de dado com o período e mantêm resumo", () => {
  const m = buildModel(daily, fund, null);
  const [a] = periodCharts(m, "annual");
  const [q] = periodCharts(m, "quarter");
  assert.ok(a?.summary.includes("100,0") && q?.summary.includes("25,0"));
  assert.ok(a?.title.includes("FY2025") && q?.title.includes("Q2 2026"));
});
