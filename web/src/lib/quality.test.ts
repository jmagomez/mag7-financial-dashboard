import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { parseSnapshots } from "./credit.ts";
import { parseQuality } from "./quality.ts";

const ok = { pricesTier: "secondary", cdsCount: 5, cdsAvgAgeDays: 12.4, cdsMaxAgeDays: 40, cdsStale: 1 };

test("parseQuality: aceita o objeto válido e rejeita nível, faixa, inteiro e incoerência", () => {
  assert.deepEqual(parseQuality(ok), ok);
  for (const bad of [undefined, null, "x", [], { ...ok, pricesTier: "ouro" }, { ...ok, cdsCount: 0 }, { ...ok, cdsCount: 8 }, { ...ok, cdsAvgAgeDays: -1 }, { ...ok, cdsMaxAgeDays: 3.5 }, { ...ok, cdsStale: 6 }, { ...ok, cdsMaxAgeDays: 5 }, { ...ok, cdsAvgAgeDays: "12" }]) {
    assert.equal(parseQuality(bad), null);
  }
});

test("parseSnapshots: mantém quality válida, descarta a malformada e não cria a chave quando falta", () => {
  const snaps = parseSnapshots({
    snapshots: [
      { date: "2026-11-10", cds: { A: 1 }, quality: ok },
      { date: "2026-11-11", cds: { A: 1 }, quality: { ...ok, cdsCount: 99 } },
      { date: "2026-11-09", cds: { A: 1 } },
    ],
  });
  assert.deepEqual(snaps.map((s) => s.date), ["2026-11-09", "2026-11-10", "2026-11-11"]);
  assert.deepEqual(snaps[1]?.quality, ok);
  assert.ok(!("quality" in (snaps[0] as object)) && !("quality" in (snaps[2] as object)));
});

test("arquivo real: todo snapshot com quality passa no parser (contrato igual ao do daily.py)", () => {
  const raw = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "..", "history", "snapshots.json"), "utf-8")) as { snapshots: { quality?: unknown }[] };
  const withQ = raw.snapshots.filter((s) => s.quality !== undefined);
  assert.equal(parseSnapshots(raw).filter((s) => s.quality).length, withQ.length);
});
