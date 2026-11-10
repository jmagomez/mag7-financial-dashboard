/**
 * Glossário de siglas (`glossary.json`, fonte única também usada pelo e-mail e por `validate.py`).
 * Tudo sai como nós de texto do vdom: a dica é o atributo `title` de um <abbr>, nunca HTML.
 */
import { h, type Child } from "./vdom.ts";

export type Glossary = Readonly<Record<string, string>>;

/** Aceita só `{ "SIGLA": "definição" }`; chaves que começam com "_" (documentação) e valores que não são texto são ignorados. */
export function parseGlossary(raw: unknown): Glossary {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith("_") || k.length === 0 || k.length > 40 || typeof v !== "string" || v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Marca a PRIMEIRA ocorrência de cada sigla (por bloco: `seen` é compartilhado entre os textos do bloco) com <abbr title>.
 * Só casa a sigla inteira: "PD" não casa em "PDF" nem em "xPD"; as mais longas têm prioridade (ex.: "CapEx" antes de "EV").
 */
export function glossify(text: string, g: Glossary, seen: Set<string>): Child[] {
  const keys = Object.keys(g).sort((a, b) => b.length - a.length);
  if (keys.length === 0) return [text];
  const re = new RegExp(`(^|[^A-Za-z0-9_])(${keys.map(escapeRe).join("|")})(?![A-Za-z0-9_])`, "g");
  const out: Child[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const key = m[2] as string;
    if (seen.has(key)) continue;
    seen.add(key);
    const start = (m.index ?? 0) + (m[1] as string).length;
    out.push(text.slice(last, start), h("abbr", { class: "g", title: g[key] }, key));
    last = start + key.length;
  }
  out.push(text.slice(last));
  return out;
}
