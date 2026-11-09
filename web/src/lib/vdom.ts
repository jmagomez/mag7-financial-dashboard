/**
 * Árvore virtual mínima. Texto vira SEMPRE nó de texto (nunca HTML) e atributos são validados na criação,
 * então não há caminho de `innerHTML` para dado externo. `toHtml` serve a testes e a impressão; `mount` cria o DOM.
 */
import { escapeHtml, safeHttpsUrl } from "./escape.ts";

export type Child = VNode | string | null | false | undefined;
export type AttrValue = string | number | boolean | undefined;
export interface VNode {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: readonly (VNode | string)[];
}

const ATTR_NAME = /^[a-zA-Z][-a-zA-Z0-9]*$/;
const VOID = new Set(["br", "hr", "img", "input", "meta", "link"]);
const SVG_TAGS = new Set(["svg", "g", "rect", "line", "text", "title", "desc"]);

function cleanAttrs(tag: string, raw: Record<string, AttrValue>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === false) continue;
    if (!ATTR_NAME.test(k) || /^on/i.test(k) || k === "style" || k === "srcdoc") {
      throw new Error(`atributo não permitido em <${tag}>: ${k}`);
    }
    if (k === "src") throw new Error("src não é permitido (sem recursos externos na v2)");
    const s = v === true ? "" : String(v);
    if (k === "href") {
      if (s.startsWith("#")) out[k] = s;
      else {
        const safe = safeHttpsUrl(s);
        if (safe === null) continue; // URL insegura: o link simplesmente não é criado
        out[k] = safe;
        out["rel"] = "noopener noreferrer";
      }
      continue;
    }
    out[k] = s;
  }
  return out;
}

export function h(tag: string, attrs: Record<string, AttrValue> = {}, ...children: Child[]): VNode {
  return {
    tag,
    attrs: cleanAttrs(tag, attrs),
    children: children.filter((c): c is VNode | string => c !== null && c !== false && c !== undefined),
  };
}

export function toHtml(n: VNode | string): string {
  if (typeof n === "string") return escapeHtml(n);
  const attrs = Object.entries(n.attrs)
    .map(([k, v]) => (v === "" ? ` ${k}` : ` ${k}="${escapeHtml(v)}"`))
    .join("");
  if (VOID.has(n.tag)) return `<${n.tag}${attrs}>`;
  return `<${n.tag}${attrs}>${n.children.map(toHtml).join("")}</${n.tag}>`;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function mount(n: VNode | string, doc: Document = document, inSvg = false): Node {
  if (typeof n === "string") return doc.createTextNode(n);
  const svg = inSvg || n.tag === "svg";
  const el = svg && SVG_TAGS.has(n.tag) ? doc.createElementNS(SVG_NS, n.tag) : doc.createElement(n.tag);
  for (const [k, v] of Object.entries(n.attrs)) el.setAttribute(k, v);
  for (const c of n.children) el.append(mount(c, doc, svg));
  return el;
}
