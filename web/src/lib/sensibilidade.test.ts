import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveAll, impliedGrowth } from "./finance.ts";
import { sensitivityRows, WACC_STEPS } from "./sensibilidade.ts";
import type { CompanyInput, Derived } from "../types.ts";

const co = (ticker: string, marketCapB: number): CompanyInput =>
  ({ ticker, price: 10, marketCapB, weight: 50, cds: null, rating: { sp: "AA", moody: "Aa2" }, annual: {}, quarter: {}, revHistory: [1, 1, 1, 1], niHistory: [1, 1, 1, 1], fcfAnnual: [1], capex: [1], valuation: {} }) as unknown as CompanyInput;
const derived = (extra: Record<string, unknown> = {}): Derived =>
  ({
    balanceQ2_2026: { AAA: { cash: 50, debt: 100 }, BBB: { cash: 10, debt: 10 } },
    fcfTTM: { AAA: 40, BBB: -5 },
    fwdPE: {},
    ebitdaImplB: {},
    fwdEPS: {},
    oneOffTTM: {},
    dcfAssumptions: { waccPct: 9, terminalGrowthPct: 3, years: 10 },
    ...extra,
  }) as unknown as Derived;

test("coluna central = crescimento implícito do gráfico; cada passo refaz o DCF com o WACC deslocado (conta à mão)", () => {
  const cs = [co("AAA", 1000), co("BBB", 500)];
  const d = derived();
  const rows = sensitivityRows(cs, d);
  const res = deriveAll(cs, d);
  assert.equal(rows[0]?.cells[WACC_STEPS.indexOf(0)], (res as Record<string, { valuation: { impliedG: number | null } }>).AAA!.valuation.impliedG);
  // EV = 1000 − (50 − 100) = 1050; WACC 8% e 10% pela mesma função pura
  assert.equal(rows[0]?.cells[1], impliedGrowth(1050, 40, { waccPct: 8, terminalGrowthPct: 3, years: 10 }));
  assert.equal(rows[0]?.cells[3], impliedGrowth(1050, 40, { waccPct: 10, terminalGrowthPct: 3, years: 10 }));
  // WACC maior exige mais crescimento para sustentar o mesmo EV
  const v = rows[0]!.cells as number[];
  assert.ok(v.every((x, i) => i === 0 || x > (v[i - 1] as number)));
  assert.equal(rows[0]?.perCompany, false);
  assert.equal(rows[0]?.baseWaccPct, 9);
});

test("FCF ≤ 0 vira null em todas as colunas, e WACC ≤ crescimento terminal vira null só nessa coluna", () => {
  const rows = sensitivityRows([co("AAA", 1000), co("BBB", 500)], derived());
  assert.deepEqual(rows[1]?.cells, [null, null, null, null, null]);
  const low = sensitivityRows([co("AAA", 1000)], derived({ dcfAssumptions: { waccPct: 4, terminalGrowthPct: 3, years: 10 } }));
  assert.equal(low[0]?.cells[0], null); // WACC 2% ≤ g 3%
  assert.equal(low[0]?.cells[1], null); // WACC 3% ≤ g 3%
  assert.notEqual(low[0]?.cells[2], null);
});

test("empresa sem balanço fica de fora (sem EV não há DCF)", () => {
  assert.deepEqual(sensitivityRows([co("ZZZ", 100)], derived()), []);
});

test("com waccInputs, a coluna central usa o WACC da empresa", () => {
  const S = { label: "x", url: "https://example.com" };
  const wi = { asOf: "2026-11-12", rfPct: 5, rfSource: S, erpPct: 4, erpAsOf: "2026-11-01", erpSource: S, taxPct: 21, ratingSpreadsPct: { AA: 0.55 }, spreadsSource: S, betas: { AAA: { beta: 2, asOf: "2026-11-08", source: S } }, note: "n" };
  const cs = [co("AAA", 1000)];
  const d = derived({ waccInputs: wi });
  const row = sensitivityRows(cs, d)[0]!;
  assert.equal(row.perCompany, true);
  assert.equal(row.baseWaccPct, 11.02);
  assert.equal(row.cells[2], (deriveAll(cs, d) as Record<string, { valuation: { impliedG: number | null } }>).AAA!.valuation.impliedG);
});
