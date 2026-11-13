import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { derivedDateRows } from "../lib/datas.ts";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { toHtml } from "../lib/vdom.ts";
import { footerBlock } from "./credit.ts";
import { datasBlock } from "./datas.ts";
import { buildModel } from "./model.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), "utf-8")) as T;
const S = { label: "Release <b>x</b>", url: "https://exemplo.com/x" };

test("linhas só dos blocos v2 bem formados; número solto e entrada malformada ficam de fora", () => {
  const rows = derivedDateRows({
    fcfTTM: { AAA: { value: 1, asOf: "2026-06-30", tier: "primary", source: S }, BBB: 5, CCC: { value: 2, asOf: "30/06/2026", tier: "primary", source: S } },
    oneOffTTM: { AAA: { value: 1, asOf: "2026-06-30", tier: "estimado", source: S } },
    ebitdaImplB: { AAA: { value: 1, asOf: "2026-08-27", tier: "derived", source: { label: "x" } } },
    fwdPE: { AAA: 20 },
  });
  assert.deepEqual(rows.map((r) => `${r.block}.${r.ticker}`), ["fcfTTM.AAA"]);
  assert.deepEqual(derivedDateRows(undefined), []);
});

test("arquivo real: 39 linhas (6 blocos migrados) e seção no rodapé com datas pt-BR e nomes escapados", () => {
  const fund = readJson<FundamentalsFile>("fundamentals.json");
  const daily = readJson<DailyFile>("data.json");
  const rows = derivedDateRows(fund.derived);
  assert.equal(rows.length, 7 + 4 + 7 + 7 + 7 + 7);
  const m = buildModel(daily, fund);
  const html = toHtml(datasBlock(m)!);
  assert.ok(html.includes("Datas e fontes dos dados trimestrais") && html.includes("Apple") && html.includes("derivada"));
  assert.ok(toHtml(footerBlock(m)).includes("Datas e fontes dos dados trimestrais"));
});

test("sem blocos v2 a seção some; fonte não https vira texto, sem link", () => {
  assert.equal(datasBlock({ derivedDates: [], names: {} } as never), null);
  assert.equal(datasBlock({} as never), null);
  const row = { block: "fcfTTM", what: "FCF", ticker: "AAA", asOf: "2026-06-30", tier: "primary" as const, source: { label: "Release <b>x</b>", url: "javascript:alert(1)" } };
  const html = toHtml(datasBlock({ derivedDates: [row], names: { AAA: "Alfa <i>" } } as never)!);
  assert.ok(!html.includes("javascript:") && !html.includes("<b>") && !html.includes("<i>"));
  assert.ok(html.includes("Release &lt;b&gt;x&lt;/b&gt;") && html.includes("Alfa &lt;i&gt;"));
});
