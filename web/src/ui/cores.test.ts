import assert from "node:assert/strict";
import { test } from "node:test";
import { toHtml } from "../lib/vdom.ts";
import { chartFrame } from "./chart-frame.ts";

test("barra com slot usa a cor fixa da empresa; sem slot usa o destaque; esmaecida ignora o slot", () => {
  const html = toHtml(
    chartFrame({
      id: "c-x",
      title: "T",
      unit: "x",
      summary: "s",
      data: [
        { label: "A", value: 3, slot: 2 },
        { label: "B", value: 2 },
        { label: "C", value: 1, slot: 4, dim: true },
      ],
    }),
  );
  assert.ok(html.includes('class="bar c2"'));
  assert.ok(html.includes('class="bar"'));
  assert.ok(html.includes('class="bar dim"'));
  assert.ok(!html.includes("c4"));
});
