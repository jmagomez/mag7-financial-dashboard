import { safeHttpsUrl } from "../lib/escape.ts";
import { fmtDateFull } from "../lib/format.ts";
import { ageChip } from "../lib/freshness.ts";
import { h, type VNode } from "../lib/vdom.ts";
import type { Brief } from "./model.ts";

export { fmtDateFull };

/**
 * Briefing diário. Tudo é texto (nó de texto); a fonte só vira link se a URL for `https:`, senão aparece só o rótulo.
 * Nenhum trecho passa por innerHTML.
 */
export function briefCard(b: Brief, generated: string): VNode {
  const chip = ageChip(b.date, generated);
  return h(
    "section",
    { class: "card brief", "aria-labelledby": "brief-title" },
    h("h2", { id: "brief-title" }, `Briefing de ${fmtDateFull(b.date)} `, h("span", { class: `chip chip-${chip.level}` }, chip.text)),
    h("p", { class: "headline" }, b.headline),
    h("ul", {}, ...b.bullets.map((x) => h("li", {}, x))),
    h(
      "p",
      { class: "src" },
      "Fontes: ",
      ...b.sources.flatMap((s, i) => [i > 0 ? " · " : null, safeHttpsUrl(s.url) ? h("a", { href: s.url }, s.label) : h("span", {}, s.label)]),
    ),
  );
}
