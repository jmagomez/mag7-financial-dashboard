import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import type { CompanyInput, Derived } from "../types.ts";
import { deriveCompany, impliedGrowth, waccOf } from "./finance.ts";
import { computeWacc, parseWaccInputs, spreadFor, type WaccInputs } from "./wacc.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const fundamentals = JSON.parse(readFileSync(join(ROOT, "fundamentals.json"), "utf-8")) as { derived: { waccInputs: unknown } };

const S = { label: "fonte", url: "https://example.com/x" };
const raw = {
  asOf: "2026-11-12",
  rfPct: 5,
  rfSource: S,
  erpPct: 4,
  erpAsOf: "2026-11-01",
  erpSource: S,
  taxPct: 21,
  ratingSpreadsPct: { AAA: 0.4, AA: 0.55, "A+": 0.7, "A-": 0.89, BBB: 1.11 },
  spreadsSource: S,
  betas: { AAA: { beta: 2, asOf: "2026-11-08", source: S } },
  note: "nota",
};
const wi = parseWaccInputs(raw) as WaccInputs;

describe("parseWaccInputs", () => {
  it("aceita o bloco válido e o fundamentals.json real (7 betas)", () => {
    assert.ok(wi);
    const real = parseWaccInputs(fundamentals.derived.waccInputs);
    assert.ok(real);
    assert.equal(Object.keys(real.betas).length, 7);
  });
  it("rejeita fora da faixa, data inválida, fonte ou betas ausentes (null, sem quebrar o painel)", () => {
    for (const bad of [
      undefined,
      "x",
      { ...raw, rfPct: 50 },
      { ...raw, erpPct: -1 },
      { ...raw, asOf: "ontem" },
      { ...raw, rfSource: { label: "x" } },
      { ...raw, betas: {} },
      { ...raw, betas: { AAA: { beta: 0, asOf: "2026-11-08", source: S } } },
      { ...raw, ratingSpreadsPct: { AA: -1 } },
    ]) {
      assert.equal(parseWaccInputs(bad), null);
    }
  });
});

describe("spreadFor", () => {
  it("rating exato; AA+ e AA− usam AA; BBB− usa BBB; desconhecido ou ausente → null", () => {
    assert.equal(spreadFor("A+", wi.ratingSpreadsPct), 0.7);
    assert.equal(spreadFor("A-", wi.ratingSpreadsPct), 0.89);
    assert.equal(spreadFor("AA+", wi.ratingSpreadsPct), 0.55);
    assert.equal(spreadFor("AA−", wi.ratingSpreadsPct), 0.55);
    assert.equal(spreadFor("BBB-", wi.ratingSpreadsPct), 1.11);
    assert.equal(spreadFor("CCC", wi.ratingSpreadsPct), null);
    assert.equal(spreadFor(undefined, wi.ratingSpreadsPct), null);
  });
});

describe("computeWacc (conta feita à mão)", () => {
  it("β 2,0, E 1000, D 100, AA: β ajustado 1,67; Ke 11,68; Kd 5,55; WACC 11,02", () => {
    // Ke = 5 + (0,67·2 + 0,33)·4 = 11,68; Kd = 5 + 0,55 = 5,55; E/(D+E) = 1000/1100
    // WACC = 0,90909·11,68 + 0,09091·5,55·0,79 = 10,61818 + 0,39859 = 11,01677
    assert.deepEqual(computeWacc("AAA", 1000, 100, "AA+", wi), { ticker: "AAA", beta: 2, betaAdj: 1.67, keePct: 11.68, spreadPct: 0.55, kdPct: 5.55, equityW: 90.91, waccPct: 11.02 });
  });
  it("sem dívida, WACC = Ke; sem beta, rating conhecido ou market cap válido → null", () => {
    assert.equal(computeWacc("AAA", 1000, 0, "AA", wi)?.waccPct, 11.68);
    assert.equal(computeWacc("ZZZ", 1000, 0, "AA", wi), null);
    assert.equal(computeWacc("AAA", 1000, 0, "CCC", wi), null);
    assert.equal(computeWacc("AAA", 0, 0, "AA", wi), null);
    assert.equal(computeWacc("AAA", 1000, -1, "AA", wi), null);
  });
  it("dados reais: 7 empresas, entre 8% e 15%, Nvidia a maior e Microsoft a menor", () => {
    const real = parseWaccInputs(fundamentals.derived.waccInputs) as WaccInputs;
    const ratings: Record<string, string> = { AAPL: "AA+", MSFT: "AAA", NVDA: "A+", GOOGL: "AA+", AMZN: "AA", META: "AA-", TSLA: "BBB" };
    const caps: Record<string, [number, number]> = { AAPL: [5157, 84], MSFT: [3884, 40], NVDA: [4005, 33], GOOGL: [3672, 98], AMZN: [2892, 129], META: [1594, 84], TSLA: [1571, 7] };
    const rows = Object.entries(caps).map(([t, [e, d]]) => computeWacc(t, e, d, ratings[t], real));
    assert.ok(rows.every((r) => r !== null && r.waccPct > 8 && r.waccPct < 15));
    const w = Object.fromEntries(rows.map((r) => [r!.ticker, r!.waccPct]));
    assert.equal(Math.max(...Object.values(w)), w.NVDA);
    assert.equal(Math.min(...Object.values(w)), w.MSFT);
  });
});

describe("DCF reverso com WACC por empresa", () => {
  const c: CompanyInput = { ticker: "AAPL", price: 100, marketCapB: 1000, cds: null, rating: { sp: "AA" }, revHistory: [1, 1, 1, 1], niHistory: [1, 1, 1, 1], fcfAnnual: [1], capex: [1], valuation: {} };
  const base: Derived = { balanceQ2_2026: { AAPL: { cash: 50, debt: 50 } }, fcfTTM: { AAPL: 40 }, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {}, dcfAssumptions: { waccPct: 9, terminalGrowthPct: 3, years: 10 } };
  const withAapl = { ...wi, betas: { AAPL: { beta: 1, asOf: "2026-11-08", source: S } } };

  it("sem waccInputs vale o WACC único (como antes); com waccInputs usa o da empresa", () => {
    const flat = deriveCompany(c, base).valuation.impliedG;
    assert.equal(flat, impliedGrowth(1000, 40, base.dcfAssumptions));
    assert.equal(waccOf(c, base), null);
    const w = waccOf(c, { ...base, waccInputs: withAapl });
    assert.equal(w?.waccPct, 8.78); // β ajustado 1,0 → Ke 9,00; Kd 5,55; E/(D+E) = 1000/1050 → 8,78
    const per = deriveCompany(c, { ...base, waccInputs: withAapl }).valuation.impliedG;
    assert.equal(per, impliedGrowth(1000, 40, { ...base.dcfAssumptions, waccPct: w!.waccPct }));
  });
  it("empresa sem beta cai no WACC único", () => {
    const only = { ...wi, betas: { OUTRA: { beta: 1, asOf: "2026-11-08", source: S } } };
    assert.equal(deriveCompany(c, { ...base, waccInputs: only }).valuation.impliedG, deriveCompany(c, base).valuation.impliedG);
  });
});
