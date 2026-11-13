import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("index.html: idioma, viewport, descrição e ícone (Lighthouse SEO e boas práticas)", () => {
  assert.match(html, /<html lang="pt-BR">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1.0" \/>/);
  const desc = /<meta name="description" content="([^"]+)"/.exec(html)?.[1] ?? "";
  assert.ok(desc.length >= 50 && desc.length <= 160, `descrição com ${desc.length} caracteres`);
  // Ícone embutido (data:): sem isso o navegador pede /favicon.ico, que dá 404 e conta como erro de console.
  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/);
  assert.ok(!/<(script|link)[^>]+(src|href)="https?:\/\//.test(html), "nenhum recurso externo no HTML");
});
