import assert from "node:assert/strict";
import { test } from "node:test";
import { margin, marginSeries, niceTicks, spreadLabels } from "./history.ts";

test("margem: mesma fórmula do dashboard (1 casa), receita zero/ausente → null", () => {
  assert.equal(margin(24.8, 95.4), 26);
  assert.equal(margin(-1, 50), -2);
  assert.equal(margin(5, 0), null);
  assert.equal(margin(undefined, 5), null);
  assert.deepEqual(marginSeries([1, 2], [10, 0]), [10, null]);
});

test("niceTicks cobre o intervalo e inclui o zero quando ele é atravessado", () => {
  const t = niceTicks(-0.3, 148.7, 5);
  assert.ok(t.min <= -0.3 && t.max >= 148.7);
  assert.ok(t.ticks.includes(0));
  assert.ok(t.ticks.length >= 3 && t.ticks.length <= 9);
  const u = niceTicks(14, 61, 5);
  assert.ok(u.min <= 14 && u.max >= 61);
});

test("niceTicks com intervalo degenerado não gera NaN", () => {
  const t = niceTicks(5, 5);
  assert.ok(Number.isFinite(t.min) && Number.isFinite(t.max) && t.max > t.min);
});

test("spreadLabels separa rótulos colados, respeita limites e a ordem", () => {
  const out = spreadLabels([100, 101, 102, 300], 14, 0, 400);
  const sorted = [...out].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) assert.ok((sorted[i] as number) - (sorted[i - 1] as number) >= 14 - 1e-9);
  assert.ok(out[0] !== undefined && out[0] < (out[1] as number) && (out[1] as number) < (out[2] as number));
  const edge = spreadLabels([398, 399, 400], 14, 0, 400);
  assert.ok(Math.max(...edge) <= 400 && Math.min(...edge) >= 0);
});
