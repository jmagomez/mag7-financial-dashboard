import assert from "node:assert/strict";
import { test } from "node:test";
import { evAdjRows, parseEvAdjust } from "./evadj.ts";
import { parseSbc, sbcRows } from "./sbc.ts";

const S = { label: "SEC", url: "https://data.sec.gov/x" };
const sbc = (v: unknown, extra: Record<string, unknown> = {}) => ({ valueB: v, asOf: "2026-06-30", parts: "p", source: S, ...extra });
const adj = (o: unknown, f: unknown, n: unknown) => ({ opLeaseB: o, finLeaseB: f, nciB: n, asOf: "2026-06-30", source: S });

test("parseSbc: aceita entradas válidas, descarta só a malformada e devolve null sem nenhuma", () => {
  const ok = parseSbc({ AAA: sbc(10), BBB: sbc(-1), CCC: sbc(10, { asOf: "30/06/2026" }), DDD: sbc("10"), EEE: sbc(10, { source: { label: 1 } }), FFF: sbc(1000) });
  assert.deepEqual(Object.keys(ok ?? {}), ["AAA"]);
  for (const bad of [undefined, null, [], "x", {}, { AAA: sbc(0) }]) assert.equal(parseSbc(bad), null);
});

test("sbcRows: conta à mão (FCF 40, SBC 12,5, market cap 1000) e FCF ≤ 0 deixa a razão n/s", () => {
  const rows = sbcRows([{ ticker: "AAA", marketCapB: 1000 }, { ticker: "BBB", marketCapB: 500 }, { ticker: "CCC", marketCapB: 100 }, { ticker: "DDD", marketCapB: 100 }], { AAA: 40, BBB: -7.6, CCC: 5 }, parseSbc({ AAA: sbc(12.5), BBB: sbc(19.3), DDD: sbc(1) })!);
  assert.deepEqual(rows.map((r) => r.ticker), ["AAA", "BBB"]); // CCC sem SBC e DDD sem FCF ficam de fora
  assert.deepEqual([rows[0]?.afterB, rows[0]?.sbcOfFcfPct, rows[0]?.yieldAfterPct], [27.5, 31.3, 2.8]);
  assert.deepEqual([rows[1]?.afterB, rows[1]?.sbcOfFcfPct, rows[1]?.yieldAfterPct], [-26.9, null, -5.4]);
});

test("parseEvAdjust: zero é válido (sem minoritários), negativo e texto não", () => {
  const ok = parseEvAdjust({ AAA: adj(10, 2, 0), BBB: adj(-1, 2, 0), CCC: adj(10, "2", 0), DDD: adj(10, 2, 0) });
  assert.deepEqual(Object.keys(ok ?? {}), ["AAA", "DDD"]);
  for (const bad of [undefined, null, [], {}, { AAA: adj(1, 2, -3) }]) assert.equal(parseEvAdjust(bad), null);
});

test("evAdjRows: EV + operacional + financeiro + minoritários, ajuste em %, e quem não tem EV ou entrada fica de fora", () => {
  const a = parseEvAdjust({ AAA: adj(20, 5, 1), BBB: adj(1, 1, 1) })!;
  const rows = evAdjRows(["AAA", "BBB", "CCC"], { AAA: 1000, CCC: 50 }, a);
  assert.deepEqual(rows.map((r) => r.ticker), ["AAA"]);
  assert.equal(rows[0]?.adjustedB, 1026);
  assert.equal(rows[0]?.upliftPct, 2.6);
  assert.equal(evAdjRows(["AAA"], { AAA: -5 }, a)[0]?.upliftPct, null);
});
