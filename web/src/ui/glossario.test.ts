import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { glossify, parseGlossary } from "../lib/glossary.ts";
import { h, toHtml } from "../lib/vdom.ts";
import { briefCard } from "./brief.ts";
import { glossaryBlock } from "./glossary.ts";
import type { Brief, ViewModel } from "./model.ts";

const G = parseGlossary({ _doc: "x", CDS: "Credit default swap", bps: "Pontos-base", PD: "Prob. de default", EV: "Enterprise value", CapEx: "Capital expenditure", "A.B": "ponto" });
const render = (text: string, seen = new Set<string>()): string => toHtml(h("p", {}, ...glossify(text, G, seen)));

test("parseGlossary: ignora _doc, valores que não são texto e entradas vazias; preserva a ordem", () => {
  assert.deepEqual(Object.keys(G), ["CDS", "bps", "PD", "EV", "CapEx", "A.B"]);
  assert.deepEqual(parseGlossary(null), {});
  assert.deepEqual(parseGlossary([1, 2]), {});
  assert.deepEqual(parseGlossary({ A: 1, B: "", C: "ok", D: null }), { C: "ok" });
});

test("glossify: só a primeira ocorrência por bloco ganha <abbr title>; o resto fica texto", () => {
  const seen = new Set<string>();
  const a = render("CDS de 40 bps; o CDS caiu.", seen);
  assert.equal((a.match(/<abbr/g) ?? []).length, 2); // CDS (1ª) e bps
  assert.ok(a.includes('<abbr class="g" title="Credit default swap">CDS</abbr> de 40 <abbr class="g" title="Pontos-base">bps</abbr>; o CDS caiu.'));
  // bloco seguinte (mesmo `seen`): CDS e bps já foram marcados
  assert.equal(render("Novo CDS em 50 bps.", seen), "<p>Novo CDS em 50 bps.</p>");
});

test("glossify: só sigla inteira (PDF, xPD, EVs não casam), respeita pontuação e maiúsculas/minúsculas", () => {
  assert.equal(render("PDF, xPD, EVs e BPS"), "<p>PDF, xPD, EVs e BPS</p>");
  assert.ok(render("(PD) e EV/CapEx").includes(">PD</abbr>) e "));
  assert.equal((render("(PD) e EV/CapEx").match(/<abbr/g) ?? []).length, 3);
  assert.ok(render("A.B e AxB").includes(">A.B</abbr> e AxB")); // metacaractere de regex tratado como texto
});

test("glossify: texto nunca vira HTML (escapado), definição vai escapada no atributo", () => {
  const g = parseGlossary({ XSS: 'a "b" <script>x</script>' });
  const html = toHtml(h("p", {}, ...glossify("<img src=x onerror=1> XSS <b>", g, new Set())));
  assert.ok(!html.includes("<img") && !html.includes("<script>") && !html.includes("<b>"));
  assert.ok(html.includes("&lt;img") && html.includes("XSS</abbr>"));
});

test("glossify: glossário vazio devolve o texto intacto", () => {
  assert.deepEqual(glossify("CDS", {}, new Set()), ["CDS"]);
});

const brief: Brief = { headline: "CDS sobe", bullets: ["CDS de 40 bps", "PD de 2%"], sources: [], date: "2026-11-09" };
test("briefing: a dica aparece só uma vez por sigla entre manchete e tópicos", () => {
  const html = toHtml(briefCard(brief, "2026-11-09", G));
  assert.equal((html.match(/>CDS<\/abbr>/g) ?? []).length, 1);
  assert.ok(html.includes(">bps</abbr>") && html.includes(">PD</abbr>"));
  assert.ok(!toHtml(briefCard(brief, "2026-11-09")).includes("<abbr")); // sem glossário, nada muda
});

test("seção de glossário: lista todos os termos com dt/dd; sem glossário não aparece", () => {
  const m = { glossary: G } as unknown as ViewModel;
  const html = toHtml(glossaryBlock(m) as NonNullable<ReturnType<typeof glossaryBlock>>);
  assert.ok(html.includes("Glossário de siglas (6 termos)"));
  assert.equal((html.match(/<dt>/g) ?? []).length, 6);
  assert.ok(html.includes("<dt>CapEx</dt><dd>Capital expenditure</dd>"));
  assert.equal(glossaryBlock({ glossary: {} } as unknown as ViewModel), null);
});

test("glossary.json real: parseia e todas as definições são texto não vazio", () => {
  const raw: unknown = JSON.parse(readFileSync(new URL("../../../glossary.json", import.meta.url), "utf8"));
  const g = parseGlossary(raw);
  assert.ok(Object.keys(g).length >= 10);
  for (const k of ["CDS", "FCF", "CapEx"]) assert.ok(g[k] && g[k].length > 10, k);
});
