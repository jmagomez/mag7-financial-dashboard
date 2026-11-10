/** Sinais, checagem de consistência e auditoria: tudo texto (sem innerHTML); o tom nunca depende só da cor. */
import { checks, signals, sortFindings, type Tone } from "../lib/signals.ts";
import { h, type VNode } from "../lib/vdom.ts";
import type { ViewModel } from "./model.ts";

const TONE_WORD: Record<Tone, string> = { alert: "atenção", ok: "ok", neutral: "info" };

export function signalsBlock(m: ViewModel): VNode {
  return h(
    "section",
    { "aria-labelledby": "sig-title" },
    h("h2", { id: "sig-title", class: "visually-hidden" }, "Sinais calculados a partir dos dados"),
    h(
      "div",
      { class: "signals" },
      ...signals(m.audit).map((s) =>
        h(
          "div",
          { class: `sig sig-${s.tone}` },
          h("div", { class: "l" }, s.label, " ", h("span", { class: "tone" }, `(${TONE_WORD[s.tone]})`)),
          h("div", { class: "v" }, s.value),
          h("div", { class: "d" }, s.detail),
        ),
      ),
    ),
    h("p", { class: "sub" }, "Sinais calculados automaticamente a partir do data.json — sem texto editorial; mudam quando os dados mudam."),
  );
}

export function integrityBlock(m: ViewModel): VNode {
  const rows = checks(m.audit);
  const nOk = rows.filter((r) => r.ok).length;
  return h(
    "details",
    { class: "card" },
    h("summary", {}, `Checagem de consistência dos dados · ${nOk}/${rows.length} testes ok`),
    h(
      "div",
      { class: "tw" },
      h(
        "table",
        {},
        h("caption", {}, "Checagens de consistência dos dados"),
        h("thead", {}, h("tr", {}, ...["Teste", "Resultado", "Detalhe"].map((c) => h("th", { scope: "col" }, c)))),
        h("tbody", {}, ...rows.map((r) => h("tr", {}, h("th", { scope: "row" }, r.title), h("td", { class: r.ok ? "ok-t" : "warn-t" }, r.ok ? "✓ ok" : "⚠ atenção"), h("td", {}, r.detail)))),
      ),
    ),
  );
}

export function auditBlock(m: ViewModel): VNode | null {
  if (m.findings.length === 0) return null;
  const rows = sortFindings(m.findings);
  const altas = rows.filter((r) => r.sev === "alta").length;
  return h(
    "details",
    { class: "card" },
    h("summary", {}, `Auditoria crítica dos dados · ${altas} alta(s) de ${rows.length}`),
    h(
      "div",
      { class: "tw" },
      h(
        "table",
        {},
        h("caption", {}, "Achados da auditoria, por severidade"),
        h("thead", {}, h("tr", {}, ...["Sev.", "Área", "Achado", "Ação"].map((c) => h("th", { scope: "col" }, c)))),
        h("tbody", {}, ...rows.map((r) => h("tr", {}, h("td", { class: r.sev === "alta" ? "warn-t" : undefined }, r.sev), h("td", {}, r.area), h("td", {}, r.finding), h("td", { class: "muted" }, r.action)))),
      ),
    ),
  );
}
