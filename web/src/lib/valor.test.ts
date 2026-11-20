import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import type { Derived } from "../types.ts";
import { deriveAll } from "./finance.ts";
import { mergeCompanies, type DailyFile, type FundamentalsFile } from "./merge.ts";
import { SCALAR_DERIVED, unwrapDerived, valueOf } from "./valor.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), "utf-8")) as T;
const SRC = { label: "10-Q", url: "https://www.sec.gov/" };

describe("valueOf (formato v2)", () => {
  it("devolve o value do objeto v2", () => {
    assert.equal(valueOf({ value: 12.5, asOf: "2026-06-30", tier: "primary", source: SRC }), 12.5);
    assert.equal(valueOf({ value: 0 }), 0);
  });
  it("número solto e o que não é número finito viram undefined", () => {
    for (const x of [12.5, 0, null, undefined, "3", NaN, Infinity, {}, { value: "3" }, [1]]) assert.equal(valueOf(x), undefined);
  });
});

describe("unwrapDerived: só o número de cada empresa", () => {
  const fund = readJson<FundamentalsFile>("fundamentals.json");
  const daily = readJson<DailyFile>("data.json");
  const base = unwrapDerived(fund.derived);
  it("todo bloco escalar vira um número por empresa", () => {
    for (const blk of SCALAR_DERIVED) {
      const b = (base as unknown as Record<string, Record<string, unknown>>)[blk] ?? {};
      assert.ok(Object.keys(b).length > 0);
      assert.ok(Object.values(b).every((v) => typeof v === "number"));
    }
  });
  it("os indicadores saem do número de cada empresa", () => {
    const comps = mergeCompanies(daily, fund);
    const out = deriveAll(comps, base);
    assert.ok(Object.values(out).every((r) => r.valuation.fcfYield !== undefined));
  });
  it("número solto (formato antigo) é erro, com o bloco e as empresas na mensagem", () => {
    const solto = { ...fund.derived, fcfTTM: { AAPL: 108, MSFT: 67 } } as unknown as Derived;
    assert.throws(() => unwrapDerived(solto), /derived\.fcfTTM: número solto em AAPL, MSFT/);
  });
  it("empresa sem value fica de fora (n/d)", () => {
    const sem = { ...fund.derived, fcfTTM: { AAPL: { asOf: "2026-06-30" } } } as unknown as Derived;
    assert.deepEqual(unwrapDerived(sem).fcfTTM, {});
  });
});

type V2 = { asOf: string; tier: string; source: { url: string; label: string } };
const BLOCOS_V2: Array<[string, string | null]> = [["fcfTTM", null], ["oneOffTTM", "derived"], ["ebitdaImplB", "derived"], ["fwdPE", "secondary"], ["fwdEPS", "derived"]];

describe("blocos escalares no formato v2 (leitura igual ao valor gravado)", () => {
  const fund = readJson<FundamentalsFile>("fundamentals.json");
  for (const [blk, tier] of BLOCOS_V2) {
    it(`${blk}: unwrapDerived entrega o value de cada empresa`, () => {
      const raw = (fund.derived as unknown as Record<string, Record<string, V2 & { value: number }>>)[blk] ?? {};
      assert.ok(Object.keys(raw).length > 0);
      const got = (unwrapDerived(fund.derived) as unknown as Record<string, Record<string, number>>)[blk];
      assert.deepEqual(got, Object.fromEntries(Object.entries(raw).map(([t, v]) => [t, v.value])));
    });
    it(`${blk}: cada empresa traz data, nível${tier ? ` '${tier}'` : ""} e fonte https`, () => {
      const raw = (fund.derived as unknown as Record<string, Record<string, V2>>)[blk] ?? {};
      for (const v of Object.values(raw)) {
        assert.match(v.asOf, /^\d{4}-\d{2}-\d{2}$/);
        assert.ok(["primary", "secondary", "derived"].includes(v.tier));
        if (tier) assert.equal(v.tier, tier);
        assert.ok(v.source.url.startsWith("https://") && v.source.label.length > 0);
      }
    });
  }
});

describe("balanceQ2_2026 com data, nível e fonte (v2)", () => {
  const fund = readJson<FundamentalsFile>("fundamentals.json");
  const bal = fund.derived.balanceQ2_2026 as unknown as Record<string, { cash: number; debt: number } & V2>;
  it("cash e debt seguem como chaves diretas numéricas para as 7 empresas", () => {
    assert.equal(Object.keys(bal).length, 7);
    for (const b of Object.values(bal)) {
      assert.equal(typeof b.cash, "number");
      assert.equal(typeof b.debt, "number");
    }
  });
  it("cada empresa traz data, nível e fonte https", () => {
    for (const b of Object.values(bal)) {
      assert.match(b.asOf, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(["primary", "secondary", "derived"].includes(b.tier));
      assert.ok(b.source.url.startsWith("https://"));
    }
  });
});
