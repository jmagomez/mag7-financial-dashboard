import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeHtml, safeHttpsUrl } from "./escape.ts";
import { h, toHtml } from "./vdom.ts";

const XSS = `<script>alert(1)</script><img src=x onerror=alert(1)>`;

test("escapeHtml neutraliza os 5 caracteres perigosos", () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});

test("texto injetado (ex.: dailyBrief) nunca vira marcação", () => {
  const html = toHtml(h("li", {}, XSS));
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("valor de atributo é escapado", () => {
  assert.equal(toHtml(h("p", { "aria-label": `" onmouseover="x` }, "a")), `<p aria-label="&quot; onmouseover=&quot;x">a</p>`);
});

test("só https vira href; javascript:, data:, http: e relativa são descartados", () => {
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "http://x.com", "//x.com", "/rel", "JaVaScRiPt:1"]) {
    assert.ok(!toHtml(h("a", { href: bad }, "x")).includes("href"), bad);
  }
  const ok = toHtml(h("a", { href: "https://exemplo.com/a?b=1" }, "x"));
  assert.ok(ok.includes(`href="https://exemplo.com/a?b=1"`));
  assert.ok(ok.includes(`rel="noopener noreferrer"`));
  assert.equal(toHtml(h("a", { href: "#val" }, "x")), `<a href="#val">x</a>`);
});

test("atributos de evento, style, src e nomes malformados são recusados", () => {
  assert.throws(() => h("div", { onclick: "x()" }));
  assert.throws(() => h("div", { style: "x:y" }));
  assert.throws(() => h("img", { src: "https://x.com/a.png" }));
  assert.throws(() => h("div", { 'a"b': "x" }));
});

test("safeHttpsUrl rejeita não-string e lixo", () => {
  assert.equal(safeHttpsUrl(undefined), null);
  assert.equal(safeHttpsUrl("não é url"), null);
  assert.equal(safeHttpsUrl("https://a.com"), "https://a.com/");
});
