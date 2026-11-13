import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseSharesOut, reconcileShares } from "../lib/shares.ts";
import { toHtml } from "../lib/vdom.ts";
import { sharesBlock } from "./acoes.ts";
import type { ViewModel } from "./model.ts";

const src = { label: "10-Q", url: "https://www.sec.gov/x" };
const raw = {
  AAA: { asOf: "2026-10-21", total: 100, form: "10-Q", source: src },
  BBB: { asOf: "2026-10-21", total: 300, classes: { A: 200, B: 100 }, form: "10-Q", source: src },
};

test("parseSharesOut aceita bloco válido e rejeita o malformado inteiro", () => {
  assert.deepEqual(Object.keys(parseSharesOut(raw) ?? {}), ["AAA", "BBB"]);
  assert.equal(parseSharesOut(undefined), null);
  assert.equal(parseSharesOut({}), null);
  assert.equal(parseSharesOut({ AAA: { ...raw.AAA, total: -1 } }), null);
  assert.equal(parseSharesOut({ AAA: { ...raw.AAA, asOf: "ontem" } }), null);
  assert.equal(parseSharesOut({ BBB: { ...raw.BBB, classes: { A: 200, B: 50 } } }), null); // classes não somam o total
  assert.equal(parseSharesOut({ BBB: { ...raw.BBB, classes: { A: 200, B: 100.2 } } })?.BBB?.classes?.B, 100.2); // arredondamento da capa (≤ 0,1%)
});

test("ações implícitas = market cap ÷ preço; aviso só acima de 2%", () => {
  const sh = parseSharesOut(raw)!;
  const rows = reconcileShares(
    [
      { ticker: "AAA", price: 10, marketCapB: 1.01 }, // 101 mi implícitas: +1%
      { ticker: "BBB", price: 10, marketCapB: 3.1 }, // 310 mi: +3,33%
      { ticker: "CCC", price: 10, marketCapB: 1 }, // sem dado reportado: fora
      { ticker: "AAA", price: 0, marketCapB: 1 }, // preço inválido: fora
    ],
    sh,
  );
  assert.equal(rows.length, 2);
  assert.ok(Math.abs((rows[0]?.diffPct ?? 0) - 1) < 1e-9 && rows[0]?.warn === false);
  assert.ok(Math.abs((rows[1]?.diffPct ?? 0) - 3.3333333) < 1e-5 && rows[1]?.warn === true);
});

test("seção do rodapé: some sem dado; mostra classes, fonte https e aviso; escapa texto", () => {
  const base = {
    names: { AAA: "Alfa <b>x</b>", BBB: "Beta" },
    companies: [
      { ticker: "AAA", price: 10, marketCapB: 1.01 },
      { ticker: "BBB", price: 10, marketCapB: 3.1 },
    ],
    sharesOut: null,
  } as unknown as ViewModel;
  assert.equal(sharesBlock(base), null);
  const html = toHtml(sharesBlock({ ...base, sharesOut: parseSharesOut(raw) })!);
  assert.ok(html.includes("1 acima de 2%"));
  assert.ok(html.includes("A: 200 · B: 100"));
  assert.ok(html.includes('href="https://www.sec.gov/x"'));
  assert.ok(html.includes("⚠ +3,33%"));
  assert.ok(!html.includes("<b>x"));
  const bad = parseSharesOut({ AAA: { ...raw.AAA, source: { label: "x", url: "javascript:alert(1)" } } });
  assert.ok(!toHtml(sharesBlock({ ...base, sharesOut: bad })!).includes("javascript:"));
});

test("fundamentals.json real: bloco válido com as 7 empresas (a divergência é aviso no painel, não falha de teste)", () => {
  const f = JSON.parse(readFileSync(new URL("../../../fundamentals.json", import.meta.url), "utf8"));
  const sh = parseSharesOut(f.derived.sharesOut);
  assert.ok(sh);
  assert.equal(Object.keys(sh).length, 7);
});
