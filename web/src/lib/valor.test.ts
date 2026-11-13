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

describe("balanceQ2_2026 com data, nível e fonte (v2)", () => {
  const fund = readJson<FundamentalsFile>("fundamentals.json");
  const bal = fund.derived.balanceQ2_2026 as unknown as Record<string, { cash: number; debt: number; asOf: string; tier: string; source: { url: string } }>;
  it("mesmos números de antes da conversão", () => {
    const got = Object.fromEntries(Object.entries(bal).map(([t, b]) => [t, [b.cash, b.debt]]));
    assert.deepEqual(got, { AAPL: [146.5, 84.3], MSFT: [76.8, 40.3], NVDA: [56.6, 33.4], GOOGL: [242.5, 98.2], AMZN: [123.0, 128.9], META: [90.3, 83.7], TSLA: [37.0, 7.0] });
  });
  it("cada empresa traz data, nível e fonte https", () => {
    for (const [t, b] of Object.entries(bal)) {
      assert.match(b.asOf, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(b.tier, t === "TSLA" ? "derived" : "primary");
      assert.ok(b.source.url.startsWith("https://"));
    }
  });
});

describe("fwdPE no formato v2", () => {
  const fund = readJson<FundamentalsFile>("fundamentals.json");
  it("mesmos números de antes da conversão", () => {
    assert.deepEqual(unwrapDerived(fund.derived).fwdPE, { AAPL: 34, MSFT: 20, NVDA: 18, GOOGL: 23, AMZN: 31, META: 14, TSLA: 188 });
  });
  it("cada empresa traz data, nível 'secondary' e fonte https", () => {
    for (const v of Object.values(fund.derived.fwdPE as unknown as Record<string, { asOf: string; tier: string; source: { url: string } }>)) {
      assert.match(v.asOf, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(v.tier, "secondary");
      assert.ok(v.source.url.startsWith("https://"));
    }
  });
});

describe("fwdEPS no formato v2", () => {
  const fund = readJson<FundamentalsFile>("fundamentals.json");
  it("mesmos números de antes da conversão", () => {
    assert.deepEqual(unwrapDerived(fund.derived).fwdEPS, { AAPL: 9.16, MSFT: 24.97, NVDA: 12.46, GOOGL: 14.67, AMZN: 8.31, META: 41.62, TSLA: 1.86 });
  });
  it("cada empresa traz data, nível 'derived' e fonte https", () => {
    for (const v of Object.values(fund.derived.fwdEPS as unknown as Record<string, { asOf: string; tier: string; source: { url: string } }>)) {
      assert.match(v.asOf, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(v.tier, "derived");
      assert.ok(v.source.url.startsWith("https://"));
    }
  });
});
