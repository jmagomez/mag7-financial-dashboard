import "./styles.css";
import "./glossary.css";
import { parseRoute, TABS, tabHash, type Tab } from "./lib/router.ts";
import { toCsv } from "./lib/csv.ts";
import { mount } from "./lib/vdom.ts";
import { appView, type State } from "./ui/app.ts";
import { csvFilename, csvTable } from "./ui/csv.ts";
import { buildModel } from "./ui/model.ts";
import type { DailyFile, FundamentalsFile } from "./lib/merge.ts";

const root = document.getElementById("app");
let state: State = { status: "loading" };
/** Aba que deve receber o foco depois da próxima renderização (setas do teclado). */
let focusAfterRender: string | null = null;

async function getJson<T>(name: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}${name}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

function render(): void {
  if (!root) return;
  root.replaceChildren(mount(appView(state, parseRoute(location.hash))));
  // Tabelas que rolam na horizontal precisam ser alcançáveis pelo teclado (axe: scrollable-region-focusable).
  root.querySelectorAll<HTMLElement>(".tw").forEach((el) => {
    el.tabIndex = 0;
  });
  // O hashchange dispara depois do handler de teclado e a renderização troca o DOM: o foco tem de ser dado aqui, no elemento novo.
  if (focusAfterRender) {
    document.getElementById(focusAfterRender)?.focus();
    focusAfterRender = null;
  }
}

addEventListener("hashchange", render);
// Exportação CSV: o vdom não aceita handlers (on*), então o clique é delegado aqui.
document.addEventListener("click", (e) => {
  if (!(e.target instanceof Element) || !e.target.closest("#csv-btn") || state.status !== "ready") return;
  const url = URL.createObjectURL(new Blob([toCsv(csvTable(state.model))], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = csvFilename(state.model);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
// Setas esquerda/direita entre as abas (padrão WAI-ARIA para tablist).
document.addEventListener("keydown", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement) || t.getAttribute("role") !== "tab") return;
  const i = TABS.findIndex((x) => `t-${x.id}` === t.id);
  const next: Tab | undefined = e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length]?.id : e.key === "ArrowLeft" ? TABS[(i - 1 + TABS.length) % TABS.length]?.id : undefined;
  if (next) {
    e.preventDefault();
    focusAfterRender = `t-${next}`;
    location.hash = tabHash(next);
  }
});

render();
// Snapshots são opcionais: se falharem, só a tendência do CDS mostra aviso (buildModel recebe null).
const snaps = getJson<unknown>("history/snapshots.json").catch(() => null);
// Glossário também é opcional: sem ele o painel só perde as dicas e a seção.
const gloss = getJson<unknown>("glossary.json").catch(() => null);
Promise.all([getJson<DailyFile>("data.json"), getJson<FundamentalsFile>("fundamentals.json"), snaps, gloss])
  .then(([d, f, s, g]) => {
    state = { status: "ready", model: buildModel(d, f, s, g) };
  })
  .catch((err: unknown) => {
    state = { status: "error", message: err instanceof Error ? err.message : String(err) };
  })
  .finally(render);
