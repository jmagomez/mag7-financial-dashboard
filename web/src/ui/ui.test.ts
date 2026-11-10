import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fmtNum } from "../lib/format.ts";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { toHtml } from "../lib/vdom.ts";
import { chartFrame, ranked } from "./chart-frame.ts";
import { cdsChart, peChart } from "./charts.ts";
import { buildModel } from "./model.ts";

// Fixture sintética: não depende do data.json do dia (que muda todo dia útil).
const daily: DailyFile = {
  meta: {
    generated: "2026-11-09",
    marketSnapshot: "2026-11-06",
    totalMarketCapT: 1,
    cdsAsOf: { AAA: "2026-11-06", BBB: "2026-07-29", REF: "2026-11-06" },
    cdsRef: [{ ticker: "REF", name: "Ref <b>", cds: 300 }],
  },
  companies: [
    { ticker: "AAA", price: 10, marketCapB: 100, weight: 50, cds: 120 },
    { ticker: "BBB", price: 20, marketCapB: 200, weight: 50, cds: 500 }, // CDS velho e MAIOR: não pode liderar
  ] as unknown as DailyFile["companies"],
};
const fund = {
  companies: [
    { ticker: "AAA", name: "Alfa <script>x</script>", revHistory: [1, 1, 1, 1], niHistory: [5, 5, 5, 5], fcfAnnual: [10], capex: [2], valuation: {} },
    { ticker: "BBB", name: "Beta", revHistory: [1, 1, 1, 1], niHistory: [-1, -1, -1, -1], fcfAnnual: [10], capex: [2], valuation: {} },
  ],
  derived: { balanceQ2_2026: {}, fcfTTM: {}, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {} },
} as unknown as FundamentalsFile;

const model = buildModel(daily, fund);

test("CDS defasado fica esmaecido, fora do ranking e fora do resumo", () => {
  const spec = cdsChart(model);
  const order = ranked(spec.data).map((d) => d.label);
  assert.deepEqual(order.slice(0, 2), ["Ref <b> (ref.)", "Alfa <script>x</script>"]); // atuais, em ordem desc
  assert.equal(order[2], "Beta"); // defasado depois, mesmo valendo 500
  assert.ok(spec.summary.includes("Maior CDS atual: Ref <b> (ref.)"));
  assert.ok(spec.summary.includes("1 nível(is) com mais de 30 dias"));
});

test("P/E com lucro ≤ 0 vira n/d, nunca zero", () => {
  const spec = peChart(model);
  assert.equal(spec.data.find((d) => d.label === "Beta")?.value, null);
  assert.ok(toHtml(chartFrame(spec)).includes("n/d"));
});

test("nome de empresa malicioso é escapado no SVG e na tabela", () => {
  const html = toHtml(chartFrame(cdsChart(model)));
  assert.ok(!html.includes("<script>x"));
  assert.ok(!html.includes("<b>"));
  assert.ok(html.includes("&lt;script&gt;x&lt;/script&gt;"));
});

test("ChartFrame sempre entrega resumo, SVG rotulado e tabela com os mesmos itens", () => {
  const html = toHtml(chartFrame(cdsChart(model)));
  assert.ok(html.includes('role="img"'));
  assert.ok(html.includes("aria-label="));
  assert.ok(html.includes("<table>"));
  assert.equal((html.match(/<th scope="row">/g) ?? []).length, 3);
  assert.ok(html.includes("defasado · 29/07 · 103 d"));
});

test("fmtNum em pt-BR e n/d", () => {
  assert.equal(fmtNum(1234.5, 1), "1.234,5");
  assert.equal(fmtNum(null), "n/d");
  assert.equal(fmtNum(NaN), "n/d");
});

// ---- Contraste dos tokens (WCAG 2.x) ----
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const tokens = (block: string): Record<string, string> =>
  Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1] as string, (m[2] as string).toLowerCase()]));
const lightBlock = /:root \{([^}]*)\}/.exec(css)?.[1] ?? "";
const mediaBlock = /prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([^}]*)\}/.exec(css)?.[1] ?? "";
const darkBlock = /:root\[data-theme="dark"\] \{([^}]*)\}/.exec(css)?.[1] ?? "";

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
}
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

test("tema escuro por mídia e por atributo têm os mesmos tokens", () => {
  assert.deepEqual(tokens(mediaBlock), tokens(darkBlock));
  assert.ok(Object.keys(tokens(lightBlock)).length >= 13);
});

for (const [name, block] of [["claro", lightBlock], ["escuro", darkBlock]] as const) {
  test(`contraste AA no tema ${name}`, () => {
    const t = tokens(block);
    const g = (k: string): string => t[k] as string;
    for (const bg of ["bg", "surface"]) {
      assert.ok(ratio(g("fg"), g(bg)) >= 4.5, `fg/${bg}`);
      assert.ok(ratio(g("muted"), g(bg)) >= 4.5, `muted/${bg}`);
      assert.ok(ratio(g("accent"), g(bg)) >= 4.5, `accent/${bg}`);
    }
    assert.ok(ratio(g("dim"), g("surface")) >= 3, "dim/surface (gráfico)");
    for (const lv of ["fresh", "aging", "stale"]) assert.ok(ratio(g(`${lv}-fg`), g(`${lv}-bg`)) >= 4.5, `chip ${lv}`);
  });
}
