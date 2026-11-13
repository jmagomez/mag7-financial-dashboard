/** Seção do rodapé: ações implícitas do market cap × ações reportadas na capa do 10-Q/10-K. Só aparece se fundamentals.json trouxer `derived.sharesOut`. */
import { safeHttpsUrl } from "../lib/escape.ts";
import { fmtDateFull, fmtNum } from "../lib/format.ts";
import { reconcileShares, SHARES_DIVERGENCE_WARN } from "../lib/shares.ts";
import { h, type VNode } from "../lib/vdom.ts";
import type { ViewModel } from "./model.ts";

export function sharesBlock(m: ViewModel): VNode | null {
  const sh = m.sharesOut;
  if (!sh) return null;
  const rows = reconcileShares(m.companies, sh);
  if (rows.length === 0) return null;
  const name = (t: string): string => m.names[t] ?? t;
  const nWarn = rows.filter((r) => r.warn).length;
  const signed = (v: number): string => `${v > 0 ? "+" : ""}${fmtNum(v, 2)}%`;
  return h(
    "details",
    { class: "card" },
    h("summary", {}, `Ações em circulação: implícitas × reportadas${nWarn ? ` · ${nWarn} acima de ${SHARES_DIVERGENCE_WARN}%` : ""}`),
    h(
      "div",
      { class: "tw" },
      h(
        "table",
        {},
        h("caption", {}, "Ações implícitas no market cap (milhões) comparadas com a capa do último 10-Q/10-K"),
        h("thead", {}, h("tr", {}, ...["Empresa", "Implícitas", "Reportadas", "Diferença", "Classes", "Data", "Fonte"].map((c) => h("th", { scope: "col" }, c)))),
        h(
          "tbody",
          {},
          ...rows.map((r) => {
            const e = sh[r.ticker]!;
            const cl = e.classes ? Object.entries(e.classes).map(([k, n]) => `${k}: ${fmtNum(n, 0)}`).join(" · ") : "—";
            return h(
              "tr",
              {},
              h("th", { scope: "row" }, name(r.ticker)),
              h("td", { class: "num" }, fmtNum(r.implied, 0)),
              h("td", { class: "num" }, fmtNum(r.reported, 0)),
              h("td", { class: `num ${r.warn ? "warn-t" : ""}` }, r.warn ? `⚠ ${signed(r.diffPct)}` : signed(r.diffPct)),
              h("td", {}, cl),
              h("td", {}, fmtDateFull(e.asOf)),
              h("td", {}, safeHttpsUrl(e.source.url) ? h("a", { href: e.source.url }, `${e.form}`) : e.form),
            );
          }),
        ),
      ),
    ),
    h("p", { class: "sub" }, "O market cap diário usa ações implícitas (preço novo × market cap anterior ÷ preço anterior); aqui elas são conferidas com o número oficial. Nenhum valor do painel usa a coluna Reportadas. A classe B (Alphabet, Meta) não tem cotação própria."),
  );
}
