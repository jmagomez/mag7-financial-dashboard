#!/usr/bin/env python3
"""Valida data.json e history/snapshots.json (roda localmente e na rotina diária).

ERROS (exit 1): estrutura, tipos, tamanhos de séries, reconciliações.
AVISOS (::warning::, exit 0): dado velho (preços, CDS), calendário vencido.

Uso: python src/validate.py [--today AAAA-MM-DD]
"""
import json
import sys
from datetime import date, datetime

TICKERS = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA"]
errors, warnings = [], []


def err(m):
    errors.append(m)


def warn(m):
    warnings.append(m)


def isnum(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def pdate(s, where):
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        err(f"{where}: data inválida {s!r} (esperado AAAA-MM-DD)")
        return None


def main():
    today = date.today()
    if "--today" in sys.argv:
        today = datetime.strptime(sys.argv[sys.argv.index("--today") + 1], "%Y-%m-%d").date()

    d = json.load(open("data.json", encoding="utf-8"))
    m, comps = d["meta"], d["companies"]
    der = d.get("derived", {})

    # --- estrutura
    got = [c.get("ticker") for c in comps]
    if sorted(got) != sorted(TICKERS):
        err(f"companies: tickers esperados {TICKERS}, obtidos {got}")
    for k in ["generated", "marketSnapshot", "totalMarketCapT", "historyLabels", "fcfLabels",
              "capexLabels", "cdsRef", "cdsLog", "creditNotes", "notes"]:
        if k not in m:
            err(f"meta.{k} ausente")
    if len(m.get("creditNotes", [])) < 4:
        err("meta.creditNotes precisa ter ao menos 4 itens (a 4ª é a nota de CDS)")

    gen = pdate(m.get("generated", ""), "meta.generated")
    snap = pdate(m.get("marketSnapshot", ""), "meta.marketSnapshot")
    if gen and snap and snap > gen:
        err("marketSnapshot posterior a generated")
    if gen and gen > today:
        err(f"generated {gen} está no futuro")

    nh, nf, nc = len(m["historyLabels"]), len(m["fcfLabels"]), len(m["capexLabels"])
    tot = 0.0
    for c in comps:
        t = c["ticker"]
        for k in ["price", "weight", "marketCapB"]:
            if not isnum(c.get(k)) or c[k] <= 0:
                err(f"{t}.{k} inválido")
        if len(c["revHistory"]) != nh or len(c["niHistory"]) != nh:
            err(f"{t}: revHistory/niHistory com tamanho != historyLabels ({nh})")
        if len(c["fcfAnnual"]) != nf:
            err(f"{t}: fcfAnnual com tamanho != fcfLabels ({nf})")
        if len(c["capex"]) != nc:
            err(f"{t}: capex com tamanho != capexLabels ({nc})")
        if c.get("cds") is not None and not (isnum(c["cds"]) and 0 < c["cds"] < 5000):
            err(f"{t}.cds fora do intervalo plausível: {c['cds']}")
        for r in ("sp", "moody"):
            if not c.get("rating", {}).get(r):
                err(f"{t}.rating.{r} ausente")
        for k in ("annual", "quarter"):
            x = c[k]
            if x["revenueB"] and abs(x["netIncomeB"] / x["revenueB"] * 100 - x["netMargin"]) > 0.3:
                err(f"{t}.{k}: margem líquida declarada não reconcilia")
        tot += c["marketCapB"]
        if t not in der.get("fcfTTM", {}):
            err(f"derived.fcfTTM sem {t}")
        if t not in der.get("balanceQ2_2026", {}):
            err(f"derived.balanceQ2_2026 sem {t}")
        if t not in der.get("ebitdaImplB", {}) or t not in der.get("fwdEPS", {}):
            err(f"derived.ebitdaImplB/fwdEPS sem {t}")
    if abs(tot - m["totalMarketCapT"] * 1000) > 2:
        err(f"soma dos market caps {tot:.0f} != total {m['totalMarketCapT']*1000:.0f}")
    for c in comps:
        if abs(c["weight"] / 100 * m["totalMarketCapT"] * 1000 - c["marketCapB"]) > 2:
            err(f"{c['ticker']}: peso × total != market cap")

    # --- CDS
    refs = {r["ticker"]: r for r in m["cdsRef"]}
    for t in ("ORCL", "CRWV"):
        if t not in refs or not isnum(refs[t].get("cds")):
            err(f"cdsRef sem {t} válido")
    log = m["cdsLog"]
    dates = [pdate(x["date"], "cdsLog") for x in log]
    if None not in dates and dates != sorted(dates):
        err("cdsLog fora de ordem cronológica")
    if dates and dates[-1] and gen and dates[-1] > gen:
        err("cdsLog tem item posterior a meta.generated")
    asof = m.get("cdsAsOf", {})
    for t in TICKERS + ["ORCL", "CRWV"]:
        lvl = next((c["cds"] for c in comps if c["ticker"] == t), refs.get(t, {}).get("cds"))
        if lvl is not None:
            dt = asof.get(t)
            if not dt:
                warn(f"CDS {t}: sem data da cotação em meta.cdsAsOf")
            else:
                dd = pdate(dt, f"cdsAsOf.{t}")
                if dd and (today - dd).days > 30:
                    warn(f"CDS {t} com cotação de {dt} ({(today-dd).days} dias) — defasado")

    # --- frescor
    if snap and (today - snap).days > 3:
        warn(f"preços/market cap de {snap} ({(today-snap).days} dias) — defasados")
    for ev in m.get("catalysts", []):
        dd = pdate(ev.get("date", ""), "catalysts")
        if dd and dd < today and not ev.get("done"):
            warn(f"catalisador vencido sem 'done': {ev.get('ticker')} {ev['date']} — atualizar trimestre")
    brief = m.get("dailyBrief")
    if brief:
        bd = pdate(brief.get("date", ""), "dailyBrief.date")
        if bd and (today - bd).days > 1:
            warn(f"dailyBrief de {bd} não é de hoje/ontem")

    # --- snapshots
    try:
        hs = json.load(open("history/snapshots.json", encoding="utf-8"))["snapshots"]
        sd = [pdate(s["date"], "snapshots") for s in hs]
        if None not in sd and sd != sorted(set(sd)):
            err("snapshots: datas duplicadas ou fora de ordem")
    except FileNotFoundError:
        warn("history/snapshots.json ausente")

    for w in warnings:
        print(f"::warning::{w}")
    for e in errors:
        print(f"::error::{e}")
    print(f"validate: {len(errors)} erro(s), {len(warnings)} aviso(s)")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
