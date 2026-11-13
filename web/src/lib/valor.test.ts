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
  it("dados atuais (número simples): resultado idêntico à entrada", () => {
    assert.deepEqual(unwrapDerived(fund.derived), fund.derived);
  });
  it("embrulhar cada campo em {value,…} não muda nenhum indicador", () => {
    const comps = mergeCompanies(daily, fund);
    assert.deepEqual(deriveAll(comps, unwrapDerived(wrapped(fund.derived))), deriveAll(comps, fund.derived));
  });
  it("mistura dos dois formatos no mesmo bloco funciona", () => {
    const w = wrapped(fund.derived);
    const mixed = { ...fund.derived, fcfTTM: { ...fund.derived.fcfTTM, AAPL: (w.fcfTTM as Record<string, unknown>).AAPL } } as unknown as Derived;
    assert.deepEqual(unwrapDerived(mixed).fcfTTM, fund.derived.fcfTTM);
  });
});
