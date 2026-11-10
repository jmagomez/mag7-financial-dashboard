/** Seção "Glossário de siglas" do rodapé: lista tudo que está em `glossary.json`; sem glossário, não aparece. */
import { h, type VNode } from "../lib/vdom.ts";
import type { ViewModel } from "./model.ts";

export function glossaryBlock(m: ViewModel): VNode | null {
  const keys = Object.keys(m.glossary);
  if (keys.length === 0) return null;
  return h(
    "details",
    { class: "card" },
    h("summary", {}, `Glossário de siglas (${keys.length} termos)`),
    h("p", { class: "sub" }, "Siglas usadas nos briefings e notas; no briefing, a primeira ocorrência de cada uma traz a definição como dica (sublinhado pontilhado). Fonte única: glossary.json, também usada pelo e-mail e pela validação."),
    h("dl", { class: "gl" }, ...keys.flatMap((k) => [h("dt", {}, k), h("dd", {}, m.glossary[k])])),
  );
}
