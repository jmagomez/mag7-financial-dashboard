import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import type { CompanyInput, Derived } from "../types.ts";
import { CDS_ALERT, deriveAll, impliedGrowth, pd5, trailing } from "./finance.ts";
import { mergeCompanies, type DailyFile, type FundamentalsFile } from "./merge.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), "utf-8")) as T;

describe("pd5 (PD 5a implícita no CDS)", () => {
  const vectors = readJson<{ pd5: { bps: number; pct: number }[] }>("tests/golden/finance_vectors.json").pd5;
  for (const v of vectors) {
    it(`${v.bps} bps -> ${v.pct}%`, () => assert.equal(pd5(v.bps), v.pct));
  }
  it("null/undefined -> null (Apple e Tesla sem CDS)", () => {
    assert.equal(pd5(null), null);
    assert.equal(pd5(undefined), null);
  });
  it("é monotônica no spread", () => {
    assert.ok((pd5(139) as number) > (pd5(100) as number));
  });
  it("limiar de alerta = 100 bps (igual a src/common.py)", () => assert.equal(CDS_ALERT, 100));
});

describe("trailing", () => {
  it("soma os últimos 4", () => assert.equal(trailing([1, 2, 3, 4, 5]), 14));
  it("série curta -> null", () => assert.equal(trailing([1, 2, 3]), null));
});

describe("impliedGrowth (DCF reverso)", () => {
  const A = { waccPct: 9, terminalGrowthPct: 3, years: 10 };
  const pv = (f: number, g: number): number => {
    let s = 0;
    for (let t = 1; t <= 10; t++) s += f * Math.pow((1 + g) / 1.09, t);
    return s + (f * Math.pow(1 + g, 10) * 1.03) / 0.06 / Math.pow(1.09, 10);
  };
  it("reproduz o EV: PV(g*) ≈ EV (propriedade)", () => {
    for (const ev of [900, 2500, 4500]) {
      const g = impliedGrowth(ev, 100, A) as number;
      assert.ok(Math.abs(pv(100, g / 100) - ev) / ev < 0.01, `ev=${ev} g=${g}`);
    }
  });
  it("cresce com o EV", () => {
    assert.ok((impliedGrowth(4500, 100, A) as number) > (impliedGrowth(2500, 100, A) as number));
  });
  it("FCF ≤ 0, EV ≤ 0 ou WACC ≤ g -> null", () => {
    assert.equal(impliedGrowth(1000, -7.6, A), null);
    assert.equal(impliedGrowth(1000, 0, A), null);
    assert.equal(impliedGrowth(1000, undefined, A), null);
    assert.equal(impliedGrowth(-5, 10, A), null);
    assert.equal(impliedGrowth(1000, 10, { waccPct: 3, terminalGrowthPct: 3 }), null);
  });
  it("exigência > 30% a.a. -> null (n/s)", () => assert.equal(impliedGrowth(1e6, 1, A), null));
});

describe("paridade com o dashboard em produção (index.html é o oráculo)", () => {
  // Entradas e saídas congeladas no mesmo arquivo: não dependem do data.json vivo (muda todo dia).
  const golden = readJson<{
    generated: string;
    inputs: { companies: CompanyInput[]; derived: Derived };
    companies: {
      ticker: string;
      valuation: Record<string, number | null>;
      capexOcf: number | null;
      pd5: number | null;
    }[];
  }>("tests/golden/derived_golden.json");

  const got = deriveAll(golden.inputs.companies, golden.inputs.derived);
  it("cobre as 7 empresas", () => assert.equal(golden.companies.length, 7));
  for (const g of golden.companies) {
    it(`${g.ticker}: todos os indicadores derivados idênticos`, () => {
      const r = got[g.ticker as keyof typeof got];
      assert.deepEqual(r.valuation, g.valuation);
      assert.equal(r.capexOcf, g.capexOcf);
      assert.equal(r.pd5, g.pd5);
    });
  }
});

describe("mergeCompanies (data.json + fundamentals.json vivos)", () => {
  it("junta as 7 empresas e recusa ticker sem par", () => {
    const daily = readJson<DailyFile>("data.json");
    const fund = readJson<FundamentalsFile>("fundamentals.json");
    assert.equal(mergeCompanies(daily, fund).length, 7);
    assert.throws(() => mergeCompanies({ ...daily, companies: daily.companies.slice(1) }, fund), /sem a empresa/);
  });
});
