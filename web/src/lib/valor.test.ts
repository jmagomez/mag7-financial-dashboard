import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import type { Derived } from "../types.ts";
import { deriveAll } from "./finance.ts";
import { mergeCompanies, type DailyFile, type FundamentalsFile } from "./merge.ts";
import { unwrapDerived, valueOf } from "./valor.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), "utf-8")) as T;
const SRC = { label: "10-Q", url: "https://www.sec.gov/" };

describe("valueOf (leitor duplo)", () => {
  it("número simples e {value} dão o mesmo número", () => {
    assert.equal(valueOf(12.5), 12.5);
    assert.equal(valueOf({ value: 12.5, asOf: "2026-06-30", tier: "primary", source: SRC }), 12.5);
    assert.equal(valueOf(0), 0);
  });
  it("o que não é número finito vira undefined", () => {
    for (const x of [null, undefined, "3", NaN, Infinity, {}, { value: "3" }, [1]]) assert.equal(valueOf(x), undefined);
  });
});

describe("unwrapDerived: formato v2 ≡ formato antigo", () => {
  const fund = readJson<FundamentalsFile>("fundamentals.json");
  const daily = readJson<DailyFile>("data.json");
  const wrapped = (d: Derived): Derived => {
    const o = { ...d } as unknown as Record<string, Record<string, unknown>>;
    for (const blk of ["fcfTTM", "fwdPE", "ebitdaImplB", "fwdEPS", "oneOffTTM"]) {
      o[blk] = Object.fromEntries(Object.entries(o[blk] ?? {}).map(([t, v]) => [t, { value: v, asOf: "2026-06-30", tier: "primary", source: SRC }]));
    }
    return o as unknown as Derived;
  };
  const base = unwrapDerived(fund.derived);
  it("unwrapDerived é idempotente", () => {
    assert.deepEqual(unwrapDerived(base), base);
  });
  it("embrulhar cada campo em {value,…} não muda nenhum indicador", () => {
    const comps = mergeCompanies(daily, fund);
    assert.deepEqual(deriveAll(comps, unwrapDerived(wrapped(base))), deriveAll(comps, base));
  });
  it("mistura dos dois formatos no mesmo bloco funciona", () => {
    const w = wrapped(base);
    const mixed = { ...base, fcfTTM: { ...base.fcfTTM, AAPL: (w.fcfTTM as Record<string, unknown>).AAPL } } as unknown as Derived;
    assert.deepEqual(unwrapDerived(mixed).fcfTTM, base.fcfTTM);
  });
});

describe("fcfTTM no formato v2 (passo 2)", () => {
  const fund = readJson<FundamentalsFile>("fundamentals.json");
  it("mesmos números de antes da conversão", () => {
    assert.deepEqual(unwrapDerived(fund.derived).fcfTTM, { AAPL: 108, MSFT: 67, NVDA: 127, GOOGL: 53, AMZN: -7.6, META: 40, TSLA: 5.8 });
  });
  it("cada empresa traz data, nível e fonte https", () => {
    for (const v of Object.values(fund.derived.fcfTTM as unknown as Record<string, { asOf: string; tier: string; source: { url: string } }>)) {
      assert.match(v.asOf, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(["primary", "secondary", "derived"].includes(v.tier));
      assert.ok(v.source.url.startsWith("https://"));
    }
  });
});

describe("oneOffTTM no formato v2 (passo 3)", () => {
  const fund = readJson<FundamentalsFile>("fundamentals.json");
  it("mesmos números de antes da conversão", () => {
    assert.deepEqual(unwrapDerived(fund.derived).oneOffTTM, { MSFT: 3.2, GOOGL: 77.1, AMZN: 60, META: -15.9 });
  });
  it("cada empresa traz data, nível 'derived' e fonte https", () => {
    for (const v of Object.values(fund.derived.oneOffTTM as unknown as Record<string, { asOf: string; tier: string; source: { url: string } }>)) {
      assert.match(v.asOf, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(v.tier, "derived");
      assert.ok(v.source.url.startsWith("https://"));
    }
  });
});

describe("ebitdaImplB no formato v2", () => {
  const fund = readJson<FundamentalsFile>("fundamentals.json");
  it("mesmos números de antes da conversão", () => {
    assert.deepEqual(unwrapDerived(fund.derived).ebitdaImplB, { AAPL: 157.4, MSFT: 241.5, NVDA: 183.3, GOOGL: 161.9, AMZN: 161.9, META: 98.6, TSLA: 9.3 });
  });
  it("cada empresa traz data, nível 'derived' e fonte https", () => {
    for (const v of Object.values(fund.derived.ebitdaImplB as unknown as Record<string, { asOf: string; tier: string; source: { url: string } }>)) {
      assert.match(v.asOf, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(v.tier, "derived");
      assert.ok(v.source.url.startsWith("https://"));
    }
  });
});
