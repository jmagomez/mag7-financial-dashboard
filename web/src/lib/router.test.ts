import assert from "node:assert/strict";
import { test } from "node:test";
import { metricHash, parseRoute, parseTab, tabHash } from "./router.ts";

test("hash válido, vazio e desconhecido", () => {
  assert.equal(parseTab("#cred"), "cred");
  assert.equal(parseTab(""), "ind");
  assert.equal(parseTab("#<script>"), "ind");
  assert.equal(parseTab("#/val"), "ind");
  assert.equal(tabHash("hist"), "#hist");
});

test("sub-rota de métrica só vale na aba Histórico", () => {
  assert.deepEqual(parseRoute("#hist-ni"), { tab: "hist", metric: "ni" });
  assert.deepEqual(parseRoute("#hist-margin"), { tab: "hist", metric: "margin" });
  assert.deepEqual(parseRoute("#hist"), { tab: "hist", metric: "rev" });
  assert.deepEqual(parseRoute("#hist-xyz"), { tab: "hist", metric: "rev" });
  assert.deepEqual(parseRoute("#val-ni"), { tab: "val", metric: "rev" });
});

test("metricHash e parseRoute são inversos", () => {
  for (const m of ["rev", "ni", "margin", "fcf"] as const) assert.equal(parseRoute(metricHash(m)).metric, m);
});
