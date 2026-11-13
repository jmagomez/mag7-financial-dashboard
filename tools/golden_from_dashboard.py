#!/usr/bin/env python3
"""Gera o "golden" dos indicadores derivados a partir do dashboard ATUAL (o index.html aposentado é o oráculo).

Lê o index.html aposentado do histórico do git (`git show 3acacf7:index.html`; o arquivo saiu da raiz) e o abre num Chromium headless, serve data.json / fundamentals.json / history / glossary
do disco, substitui o Chart.js por um stub (não há rede) e lê os campos calculados no cliente
(`valuation`, `capexOcf`, `pd5`). O resultado vai para tests/golden/derived_golden.json e é
usado pelos testes do núcleo TypeScript (web/src/lib) para provar paridade numérica. O arquivo guarda
também as ENTRADAS (`inputs`), então os testes não dependem do data.json vivo; regenere só ao mudar um cálculo.

Uso (a partir da raiz do repo):  python3 tools/golden_from_dashboard.py
Requer: playwright (Python) com Chromium instalado.
"""
import json
import pathlib
import subprocess
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEGACY_REF = "3acacf7"  # último commit com o index.html na raiz
STUB = """
window.Chart = class { constructor(){ this.data={}; } destroy(){} update(){} };
window.Chart.register = function(){}; window.Chart.defaults = {font:{}, plugins:{legend:{labels:{}}}};
"""


def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        pg.route("**/chart.umd.min.js", lambda r: r.fulfill(body=STUB, content_type="application/javascript"))
        pg.route("**/fonts.googleapis.com/**", lambda r: r.fulfill(body="", content_type="text/css"))

        def local(route):
            url = route.request.url
            rel = url.split("://", 1)[1].split("/", 1)[1].split("?")[0] or "index.html"
            f = ROOT / rel
            if rel == "index.html":
                body = subprocess.run(["git", "show", f"{LEGACY_REF}:index.html"], cwd=ROOT, check=True, capture_output=True).stdout
                route.fulfill(body=body, content_type="text/html")
            elif f.is_file():
                ctype = "text/html" if rel.endswith(".html") else "application/json"
                route.fulfill(body=f.read_bytes(), content_type=ctype)
            else:
                route.fulfill(status=404, body="")

        pg.route("http://local.test/**", local)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://local.test/index.html")
        pg.wait_for_function("typeof DATA !== 'undefined' && DATA && DATA.companies && DATA.companies[0].valuation && DATA.companies[0].valuation.ev !== undefined", timeout=15000)
        out = pg.evaluate("""() => ({
          generated: DATA.meta.generated, marketSnapshot: DATA.meta.marketSnapshot,
          companies: DATA.companies.map(c => ({ticker: c.ticker, price: c.price, marketCapB: c.marketCapB, cds: c.cds,
            valuation: {pe: c.valuation.pe, peCore: c.valuation.peCore, peFwd: c.valuation.peFwd, ev: c.valuation.ev,
              evSales: c.valuation.evSales, evEbitda: c.valuation.evEbitda, net: c.valuation.net, netPct: c.valuation.netPct,
              impliedG: c.valuation.impliedG, fcfYield: c.valuation.fcfYield, fcfB: c.valuation.fcfB},
            capexOcf: c.capexOcf, pd5: c.pd5})),
          cdsRef: (DATA.meta.cdsRef || []).map(r => ({ticker: r.ticker, cds: r.cds, pd5: r.pd5})),
          // ENTRADAS congeladas junto com as saídas: o teste não depende do data.json vivo (que muda todo dia).
          inputs: {
            companies: DATA.companies.map(c => ({ticker: c.ticker, price: c.price, marketCapB: c.marketCapB, cds: c.cds ?? null,
              revHistory: c.revHistory, niHistory: c.niHistory, fcfAnnual: c.fcfAnnual, capex: c.capex,
              valuation: {fcfYield: c.valuation.fcfYieldSrc, fcfB: c.valuation.fcfBSrc}})),
            derived: Object.fromEntries(['balanceQ2_2026','fcfTTM','fwdPE','ebitdaImplB','fwdEPS','oneOffTTM','dcfAssumptions']
              .map(k => [k, DATA.derived[k]]))
          }
        })""")
        b.close()
    if errs:
        print("erros de página:", errs, file=sys.stderr)
    dest = ROOT / "tests" / "golden" / "derived_golden.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("ok ->", dest.relative_to(ROOT))


if __name__ == "__main__":
    main()
