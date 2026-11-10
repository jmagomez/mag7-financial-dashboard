import assert from "node:assert/strict";
import { test } from "node:test";
import { indHash, metricHash, parseRoute, parseTab, tabHash } from "./router.ts";

test("hash válido, vazio e desconhecido", () => {
  assert.equal(parseTab("#cred"), "cred");
  assert.equal(parseTab(""), "ind");
  assert.equal(parseTab("#<script>"), "ind");
  assert.equal(parseTab("#/val"), "ind");
  assert.equal(tabHash("hist"), "#hist");
});

test("sub-rota de métrica só vale na aba Histórico", () => {
  assert.equal(parseRoute("#hist-ni").metric, "ni");
  assert.equal(parseRoute("#hist-margin").metric, "margin");
  assert.deepEqual([parseRoute("#hist").tab, parseRoute("#hist").metric], ["hist", "rev"]);
  assert.equal(parseRoute("#hist-xyz").metric, "rev");
  assert.deepEqual([parseRoute("#val-ni").tab, parseRoute("#val-ni").metric], ["val", "rev"]);
});

test("metricHash e parseRoute são inversos", () => {
  for (const m of ["rev", "ni", "margin", "fcf"] as const) assert.equal(parseRoute(metricHash(m)).metric, m);
});

test("Indicadores: período, coluna e sentido vêm do hash; padrão = anual, market cap, decrescente", () => {
  const d = parseRoute("#ind");
  assert.deepEqual([d.period, d.sort, d.dir], ["annual", "marketCapB", -1]);
  const q = parseRoute("#ind-quarter-revenueB-asc");
  assert.deepEqual([q.tab, q.period, q.sort, q.dir], ["ind", "quarter", "revenueB", 1]);
  assert.equal(parseRoute("#ind-quarter").sort, "marketCapB");
  assert.equal(parseRoute("#ind-<script>-x").period, "annual"); // lixo é ignorado
  assert.equal(parseRoute("#val-quarter").period, "annual"); // só vale na aba Indicadores
});

test("indHash e parseRoute são inversos e omitem o padrão", () => {
  assert.equal(indHash("annual", "marketCapB", -1), "#ind");
  assert.equal(indHash("quarter", "marketCapB", -1), "#ind-quarter");
  assert.equal(indHash("annual", "price", 1), "#ind-price-asc");
  for (const period of ["annual", "quarter"] as const)
    for (const sort of ["name", "revenueB", "marketCapB", "epsDiluted"] as const)
      for (const dir of [1, -1] as const) {
        const r = parseRoute(indHash(period, sort, dir));
        assert.deepEqual([r.period, r.sort, r.dir], [period, sort, dir]);
      }
});
