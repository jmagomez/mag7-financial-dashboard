#!/usr/bin/env python3
"""Valida data.json + fundamentals.json (juntos) e history/snapshots.json (roda localmente, na rotina diária e no CI).

ERROS (exit 1): estrutura, tipos, tamanhos de séries, reconciliações.
AVISOS (::warning::, exit 0): dado velho (preços, CDS), calendário vencido.

Uso: python src/validate.py [--today AAAA-MM-DD]
"""
import json
import re
import sys
from datetime import date, datetime, timedelta

from common import path as C_path
from common import CDS_LOG_KEEP, NAMES, TICKERS, glossary, load, merge

errors, warnings = [], []
# siglas de uso corrente (ou veículos de imprensa) que dispensam entrada no glossary.json
ACRONYM_OK = {"US", "USD", "EUA", "IA", "AI", "ET", "EPS", "LPA", "SEC", "LSEG", "BNN", "CNBC", "KED", "EBITDA", "NTM",
              "NYSE", "IPO", "ETF", "CEO", "CFO", "QE"}


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

    def _bad(x):
        raise ValueError(f"constante inválida no JSON: {x}")

    for fn in ("data.json", "fundamentals.json"):  # rejeita NaN/Infinity em qualquer dos dois arquivos
        try:
            json.load(open(C_path(fn), encoding="utf-8"), parse_constant=_bad)
        except FileNotFoundError:
            if fn == "data.json":
                raise
    d = merge(load("data.json"), load("fundamentals.json"))  # formato único (diário + trimestral)
    if not (d.get("companies") and d["companies"][0].get("annual")):
        print("::error::fundamentals.json ausente ou sem correspondência com data.json (formato diário)")
        sys.exit(1)
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
        if c.get("cds") is not None and not (isnum(c["cds"]) and 5 <= c["cds"] <= 3000):
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
    wsum = sum(c["weight"] for c in comps)
    if abs(wsum - 100) > 0.5:
        err(f"soma dos pesos {wsum:.2f} != 100")
    for c in comps:
        t = c["ticker"]
        if abs(c["niHistory"][-1] - c["quarter"]["netIncomeB"]) > 0.5:
            err(f"{t}: niHistory[-1] ({c['niHistory'][-1]}) != quarter.netIncomeB ({c['quarter']['netIncomeB']})")
        if abs(c["revHistory"][-1] - c["quarter"]["revenueB"]) > 0.5:
            err(f"{t}: revHistory[-1] ({c['revHistory'][-1]}) != quarter.revenueB ({c['quarter']['revenueB']})")
        for blk in ("fcfTTM", "ebitdaImplB", "fwdEPS"):
            if not isnum(der.get(blk, {}).get(t)):
                err(f"derived.{blk}.{t} não numérico")
    if abs(tot - m["totalMarketCapT"] * 1000) > 2:
        err(f"soma dos market caps {tot:.0f} != total {m['totalMarketCapT']*1000:.0f}")
    for c in comps:
        if abs(c["weight"] / 100 * m["totalMarketCapT"] * 1000 - c["marketCapB"]) > 2:
            err(f"{c['ticker']}: peso × total != market cap")

    # --- consistência trimestral: rótulos x séries x index.html (pega o que a tarefa mensal pode esquecer)
    mq = re.match(r"Q([1-4]) (\d{4})$", m.get("quarterLabel", ""))
    if not mq:
        err(f"meta.quarterLabel inválido: {m.get('quarterLabel')!r} (esperado 'Qn AAAA')")
    else:
        qn, qy = int(mq.group(1)), int(mq.group(2))
        want = f"Q{qn}'{qy % 100:02d}"
        if m["historyLabels"][-1] != want:
            err(f"historyLabels termina em {m['historyLabels'][-1]!r}, mas quarterLabel={m['quarterLabel']!r} (esperado {want!r})")
        try:
            html = open(C_path("index.html"), encoding="utf-8").read()
            if chr(0xFEFF) in html:
                err("index.html contém caractere BOM literal (use o escape no exportador de CSV)")
            seen = [(int(y), int(q)) for q, y in re.findall(r"\b([1-4])T ?(20\d\d)\b", html)]
            seen += [(int(y), int(q)) for q, y in re.findall(r"\bQ([1-4]) (20\d\d)\b", html)]
            if seen and max(seen) < (qy, qn):
                warn(f"index.html cita no máximo {max(seen)[1]}T {max(seen)[0]}, mas o painel está em {m['quarterLabel']}: revisar rótulos/textos editoriais fixos no HTML")
        except FileNotFoundError:
            warn("index.html ausente")

    # --- CDS
    refs = {r["ticker"]: r for r in m["cdsRef"]}
    for t in ("ORCL", "CRWV"):
        if t not in refs or not isnum(refs[t].get("cds")) or not (5 <= refs[t]["cds"] <= 5000):
            err(f"cdsRef sem {t} válido (5–5000 bps)")
    log = m["cdsLog"]
    if len(log) > CDS_LOG_KEEP + 2:
        warn(f"meta.cdsLog tem {len(log)} itens (mantenha só os últimos {CDS_LOG_KEEP}; o resto fica no histórico do git)")
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
                err(f"CDS {t}: sem data da cotação em meta.cdsAsOf")
            else:
                dd = pdate(dt, f"cdsAsOf.{t}")
                if dd and dd > today:
                    err(f"cdsAsOf.{t} {dt} está no futuro")
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
    if not brief:
        err("meta.dailyBrief ausente")
    else:
        for k in ("date", "headline", "bullets", "sources"):
            if not brief.get(k):
                err(f"meta.dailyBrief.{k} ausente/vazio")
        txt = (brief.get("headline", "") + " " + " ".join(brief.get("bullets", []))).upper()
        for c in comps:
            if c.get("cds") is not None and c["cds"] > 100 and c["ticker"] not in txt and NAMES[c["ticker"]].upper() not in txt:
                err(f"{c['ticker']} com CDS {c['cds']} > 100 bps, mas o dailyBrief não menciona o alerta")
        bd = pdate(brief.get("date", ""), "dailyBrief.date")
        if bd and (today - bd).days > 1:
            warn(f"dailyBrief de {bd} não é de hoje/ontem")
        # sigla em maiúsculas no briefing que o leitor não tem como decifrar (nem ticker, nem glossário)
        known = set(glossary()) | set(TICKERS) | ACRONYM_OK
        full = brief.get("headline", "") + " " + " ".join(brief.get("bullets", []))
        unk = sorted({t for t in re.findall(r"(?<![A-Za-z0-9/&])[A-Z]{2,5}(?![A-Za-z0-9/&])", full)} - known)
        if unk:
            warn(f"dailyBrief usa sigla(s) fora do glossary.json: {', '.join(unk)} — escreva por extenso ou acrescente ao glossário")

    aud = m.get("audit")
    if not aud:
        err("meta.audit ausente/vazio")
    else:
        for i, a in enumerate(aud):
            if a.get("sev") not in ("alta", "média", "baixa") or not all(a.get(k) for k in ("area", "finding", "action")):
                err(f"meta.audit[{i}] inválido (sev alta|média|baixa e area/finding/action)")
    if len(m["creditNotes"]) >= 4:
        n3 = m["creditNotes"][3]
        for c in comps:
            if c.get("cds") is not None and f"~{c['cds']}" not in n3:
                err(f"creditNotes[3] não cita o nível atual de {c['ticker']} (~{c['cds']})")

    # --- snapshots
    try:
        hs = json.load(open("history/snapshots.json", encoding="utf-8"))["snapshots"]
        sd = [pdate(s["date"], "snapshots") for s in hs]
        if None not in sd and sd != sorted(set(sd)):
            err("snapshots: datas duplicadas ou fora de ordem")
        # saltos suspeitos (erro de digitação) vs. último snapshot anterior com o dado
        def last(key):
            for s_ in reversed(hs):
                if s_.get(key):
                    return s_
        ls = last("prices")
        if ls:
            for c in comps:
                p0 = ls["prices"].get(c["ticker"])
                if p0 and abs(c["price"] / p0 - 1) > 0.25:
                    err(f"{c['ticker']}: preço {c['price']} varia {(c['price']/p0-1)*100:+.0f}% vs snapshot {ls['date']} — erro de digitação?")
        lc = last("cds")
        if lc:
            for t, v in lc["cds"].items():
                cur = next((c["cds"] for c in comps if c["ticker"] == t), refs.get(t, {}).get("cds"))
                if cur and v:
                    ch = abs(cur / v - 1)
                    if cur / v > 2 or cur / v < 0.5:
                        err(f"CDS {t}: {v} → {cur} bps (dobrou ou caiu à metade vs snapshot {lc['date']}) — erro de digitação?")
                    elif ch > 0.25:
                        warn(f"CDS {t}: {v} → {cur} bps ({(cur/v-1)*100:+.0f}% vs snapshot {lc['date']}) — conferir fonte")
        # snapshot é por pregão: deve existir para marketSnapshot (gravado ANTES do commit final de data.json)
        last_px = last("prices")
        if snap and (not last_px or last_px["date"] < m["marketSnapshot"]):
            err(f"data.json foi para o pregão {m['marketSnapshot']} sem snapshot correspondente em history/snapshots.json (grave o snapshot antes do commit final)")
        for s_ in hs:
            if snap and s_.get("date") == m["marketSnapshot"]:
                for c in comps:
                    t = c["ticker"]
                    if s_.get("prices") and abs(s_["prices"].get(t, c["price"]) - c["price"]) > 0.005:
                        err(f"{t}: preço {c['price']} em data.json != {s_['prices'][t]} no snapshot de {s_['date']}")
                    if s_.get("marketCapB") and s_["marketCapB"].get(t, c["marketCapB"]) != c["marketCapB"]:
                        err(f"{t}: market cap {c['marketCapB']} em data.json != {s_['marketCapB'][t]} no snapshot de {s_['date']}")
                    if c.get("cds") is not None and s_.get("cds") and s_["cds"].get(t, c["cds"]) != c["cds"]:
                        err(f"{t}: CDS {c['cds']} em data.json != {s_['cds'][t]} no snapshot de {s_['date']}")
    except FileNotFoundError:
        warn("history/snapshots.json ausente")

    try:
        lg = json.load(open("history/email_log.json", encoding="utf-8")).get("lastSent")
        ld = pdate(lg or "", "email_log.lastSent")
        if ld and ld > today + timedelta(days=1):
            err(f"email_log.lastSent {lg} está no futuro")
    except FileNotFoundError:
        warn("history/email_log.json ausente")

    for w in warnings:
        print(f"::warning::{w}")
    for e in errors:
        print(f"::error::{e}")
    print(f"validate: {len(errors)} erro(s), {len(warnings)} aviso(s)")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
