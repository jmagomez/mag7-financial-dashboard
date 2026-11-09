import assert from "node:assert/strict";
import { test } from "node:test";
import { ageChip, ageDays, levelOf, tradingDays } from "./freshness.ts";

test("ageDays em dias de calendário", () => {
  assert.equal(ageDays("2026-07-29", "2026-11-09"), 103);
  assert.equal(ageDays("2026-11-09", "2026-11-09"), 0);
});

test("tradingDays ignora fim de semana (sem feriados)", () => {
  assert.equal(tradingDays("2026-11-06", "2026-11-09"), 1); // sex → seg
  assert.equal(tradingDays("2026-11-02", "2026-11-09"), 5);
  assert.equal(tradingDays("2026-11-07", "2026-11-08"), 0);
});

test("limites: ≤7 atual, ≤30 atenção, >30 defasado", () => {
  assert.equal(levelOf(7), "fresh");
  assert.equal(levelOf(8), "aging");
  assert.equal(levelOf(30), "aging");
  assert.equal(levelOf(31), "stale");
});

test("chip traz o nível em palavra e a data; sem data é defasado", () => {
  assert.deepEqual(ageChip("2026-07-29", "2026-11-09"), { level: "stale", text: "defasado · 29/07 · 103 d" });
  assert.deepEqual(ageChip("2026-11-06", "2026-11-09"), { level: "fresh", text: "atual · 06/11 · 3 d" });
  assert.equal(ageChip(null, "2026-11-09").level, "stale");
});

test("data inválida falha alto, não vira NaN silencioso", () => {
  assert.throws(() => ageDays("11/06/2026", "2026-11-09"));
});
