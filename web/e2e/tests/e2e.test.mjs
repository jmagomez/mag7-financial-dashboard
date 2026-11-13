import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { AXE_SOURCE, launch, open, ROUTES, startServer } from "./helpers.mjs";

let server;
let browser;
before(async () => {
  server = await startServer();
  browser = await launch();
});
after(async () => {
  await browser?.close();
  server?.kill();
});

describe("acessibilidade (axe-core, wcag2a/aa, wcag21aa e best-practice, tabelas alternativas abertas)", () => {
  for (const scheme of ["light", "dark"]) {
    for (const hash of ROUTES) {
      test(`${hash} · tema ${scheme}: 0 violações`, async () => {
        const { context, page } = await open(browser, hash, { colorScheme: scheme });
        await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
        await page.addScriptTag({ content: AXE_SOURCE });
        const violations = await page.evaluate(async () => {
          const r = await globalThis.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] });
          return r.violations.map((v) => `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`);
        });
        await context.close();
        assert.deepEqual(violations, []);
      });
    }
  }
});

describe("segurança e robustez", () => {
  for (const hash of ROUTES) {
    test(`${hash}: sem recursos externos, sem erro de console e sem exceção`, async () => {
      const { context, problems, external } = await open(browser, hash);
      await context.close();
      assert.deepEqual(external, [], "o painel não pode chamar nenhum host externo");
      assert.deepEqual(problems, []);
    });
  }

  test("rota inválida ou com lixo cai em Indicadores e não quebra", async () => {
    const { context, page, problems } = await open(browser, "#<script>alert(1)</script>-x");
    assert.equal(await page.getAttribute("#t-ind", "aria-selected"), "true");
    await context.close();
    assert.deepEqual(problems, []);
  });
});

describe("interação", () => {
  test("estrutura de marcos: um <main>, tablist e tabpanel, rodapé", async () => {
    const { context, page } = await open(browser, "#ind");
    assert.equal(await page.locator("main").count(), 1);
    assert.equal(await page.locator("main [role=tablist]").count(), 1);
    assert.equal(await page.locator("main [role=tabpanel]").count(), 1);
    assert.equal(await page.locator("footer").count(), 1);
    await context.close();
  });

  test("teclado: setas trocam de aba, com foco e aria-selected", async () => {
    const { context, page } = await open(browser, "#ind");
    await page.focus("#t-ind");
    await page.keyboard.press("ArrowRight");
    await page.waitForSelector("#t-val[aria-selected=true]"); // o hash muda antes da renderização: espera o resultado visível
    assert.equal(await page.evaluate(() => document.activeElement?.id), "t-val");
    await page.keyboard.press("ArrowLeft");
    await page.waitForSelector("#t-ind[aria-selected=true]");
    await context.close();
  });

  test("tabela de valuation: clicar ordena, clicar de novo inverte, hash carrega a ordem", async () => {
    const { context, page } = await open(browser, "#val");
    const order = () => page.$$eval("table:has(caption:text('Múltiplos')) tbody tr th", (r) => r.map((x) => x.textContent.trim().split(" ").pop()));
    const first = await order();
    assert.equal(first.length, 7);
    await page.click("th a:has-text('EV/EBITDA')");
    await page.waitForSelector("table:has(caption:text('Múltiplos')) th[aria-sort=descending]");
    assert.equal(await page.evaluate(() => location.hash), "#val-evEbitda");
    const desc = await order();
    await page.click("th a:has-text('EV/EBITDA')");
    await page.waitForSelector("table:has(caption:text('Múltiplos')) th[aria-sort=ascending]");
    assert.equal(await page.evaluate(() => location.hash), "#val-evEbitda-asc");
    const asc = await order();
    assert.deepEqual([...asc].reverse().sort(), [...desc].sort()); // mesmas empresas
    assert.notDeepEqual(asc, desc);
    assert.equal(await page.$$eval("table:has(caption:text('Múltiplos')) th[aria-sort=ascending]", (e) => e.length), 1);
    await page.goto(`${page.url().split("#")[0]}#val-evEbitda-asc`);
    await page.reload();
    await page.waitForSelector("#csv-btn");
    assert.deepEqual(await order(), asc);
    await context.close();
  });

  test("tabela de indicadores: período e ordenação por link", async () => {
    const { context, page } = await open(browser, "#ind");
    await page.click("a:has-text('Trimestre')");
    await page.waitForSelector("a[aria-current=page]:has-text('Trimestre')");
    await page.click("th a:has-text('Receita')");
    await page.waitForSelector("th[aria-sort=descending]:has-text('Receita')");
    assert.equal(await page.evaluate(() => location.hash), "#ind-quarter-revenueB");
    await context.close();
  });

  test("glossário: dica no briefing e seção no rodapé com os termos", async () => {
    const { context, page } = await open(browser, "#ind");
    assert.ok((await page.locator(".brief abbr[title]").count()) >= 1);
    assert.ok((await page.locator("footer dl.gl dt").count()) >= 10);
    await context.close();
  });

  test("exportar CSV: baixa arquivo com BOM, cabeçalho e uma linha por empresa", async () => {
    const { context, page } = await open(browser, "#ind");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#csv-btn")]);
    assert.match(download.suggestedFilename(), /^mag7_indicadores_\d{4}-\d{2}-\d{2}\.csv$/);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const text = Buffer.concat(chunks).toString("utf8");
    assert.equal(text.charCodeAt(0), 0xfeff);
    const lines = text.slice(1).split("\n");
    assert.equal(lines.length, 8); // cabeçalho + 7 empresas
    assert.ok(lines[0].startsWith("Ticker,Empresa,Preco_USD"));
    await context.close();
  });
});
