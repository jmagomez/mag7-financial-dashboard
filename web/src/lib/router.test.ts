import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTab, tabHash } from "./router.ts";

test("hash válido, vazio e desconhecido", () => {
  assert.equal(parseTab("#cred"), "cred");
  assert.equal(parseTab(""), "ind");
  assert.equal(parseTab("#<script>"), "ind");
  assert.equal(parseTab("#/val"), "ind");
  assert.equal(tabHash("hist"), "#hist");
});
