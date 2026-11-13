#!/usr/bin/env python3
"""Valida data.json + fundamentals.json (juntos) e history/snapshots.json (roda localmente, na rotina diária e no CI).

ERROS (exit 1): estrutura, tipos, tamanhos de séries, reconciliações.
AVISOS (::warning::, exit 0): dado velho (preços, CDS), calendário vencido.

Uso: python src/validate.py [--today AAAA-MM-DD]
"""
import glob
import json
import re
import sys
from datetime import date, datetime, timedelta

from common import (CDS_LOG_KEEP, NAMES, SBC_MAX_DAYS, SHARES_ANCHOR_MAX_DAYS, SHARES_DIVERGENCE_WARN, TICKERS, TIERS, WACC_BETA_MAX_DAYS,
                    WACC_INPUTS_MAX_DAYS, glossary, load, merge)
from common import path as C_path

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


def check_provenance(m, today):
    """meta.provenance (aditivo: ausente = ainda não gerado pelo daily.py, sem aviso). Estrutura inválida é erro; âncora velha é aviso."""
    pv = m.get("provenance")
    if pv is None:
        return
    snap = m.get("marketSnapshot")
    entries = [(k, pv.get(k)) for k in ("prices", "marketCapB", "weight")] + [(f"cds.{t}", v) for t, v in (pv.get("cds") or {}).items()]
    for name, e in entries:
        if not isinstance(e, dict):
            err(f"provenance.{name} ausente")
            continue
        if e.get("tier") not in TIERS:
            err(f"provenance.{name}.tier inválido: {e.get('tier')!r} (use {', '.join(TIERS)})")
        dd = pdate(e.get("asOf") or "", f"provenance.{name}.asOf")
        if dd and dd > today:
            err(f"provenance.{name}.asOf {e['asOf']} está no futuro")
    for k in ("prices", "marketCapB", "weight"):
        if isinstance(pv.get(k), dict) and pv[k].get("asOf") != snap:
            err(f"provenance.{k}.asOf {pv[k].get('asOf')} != marketSnapshot {snap}")
    for k in ("marketCapB", "weight"):
        if isinstance(pv.get(k), dict) and pv[k].get("tier") != "derived":
            err(f"provenance.{k}.tier deve ser 'derived' (é calculado)")
    for t, e in (pv.get("cds") or {}).items():
        if isinstance(e, dict) and e.get("asOf") != (m.get("cdsAsOf") or {}).get(t):
            err(f"provenance.cds.{t}.asOf {e.get('asOf')} != cdsAsOf.{t} {(m.get('cdsAsOf') or {}).get(t)}")
    mc = pv.get("marketCapB")
    if isinstance(mc, dict):
        a = mc.get("anchor")
        if not a:
            warn("provenance.marketCapB sem âncora das ações (rode daily.py para gravá-la)")
        else:
            ad = pdate(a.get("date") or "", "provenance.marketCapB.anchor.date")
            if ad and (today - ad).days > SHARES_ANCHOR_MAX_DAYS:
                warn(f"market cap usa ações com capa de {a['date']} ({a.get('source')}, {(today-ad).days} dias): atualizar derived.sharesOut com o 10-Q/10-K mais novo")


def check_shares(comps, der):
    """Ações usadas no market cap (market cap ÷ preço) × ações reportadas (derived.sharesOut): aviso acima de SHARES_DIVERGENCE_WARN %."""
    sh = der.get("sharesOut")
    if not isinstance(sh, dict):
        return
    for c in comps:
        e = sh.get(c["ticker"])
        if not isinstance(e, dict) or not isnum(e.get("total")) or e["total"] <= 0 or not (isnum(c.get("price")) and c["price"] > 0 and isnum(c.get("marketCapB"))):
            continue
        implied = c["marketCapB"] / c["price"] * 1000
        diff = (implied / e["total"] - 1) * 100
        if abs(diff) > SHARES_DIVERGENCE_WARN:
            warn(f"{c['ticker']}: ações no market cap ({implied:,.0f} mi) diferem {diff:+.1f}% das reportadas ({e['total']:,.0f} mi, capa de {e.get('asOf')}): desdobramento ou ações desatualizadas?")


def check_wacc(der, today):
    """derived.waccInputs (opcional: ausente = DCF reverso com o WACC único). Presente e malformado é erro; entradas velhas, aviso."""
    wi = der.get("waccInputs")
    if wi is None:
        return

    def rng(k, lo, hi):
        if not (isnum(wi.get(k)) and lo <= wi[k] <= hi):
            err(f"derived.waccInputs.{k} fora de [{lo}, {hi}]: {wi.get(k)!r}")

    def https(where, s):
        if not (isinstance(s, dict) and s.get("label") and str(s.get("url", "")).startswith("https://")):
            err(f"derived.waccInputs.{where}: fonte precisa de label e url https")

    if not isinstance(wi, dict):
        err("derived.waccInputs deve ser um objeto")
        return
    rng("rfPct", 0, 20)
    rng("erpPct", 0, 15)
    rng("taxPct", 0, 50)
    for k in ("rfSource", "erpSource", "spreadsSource"):
        https(k, wi.get(k))
    for k, label in (("asOf", "rfPct"), ("erpAsOf", "erpPct")):
        d_ = pdate(wi.get(k) or "", f"derived.waccInputs.{k}")
        if d_ and d_ > today:
            err(f"derived.waccInputs.{k} {wi[k]} está no futuro")
        elif d_ and (today - d_).days > WACC_INPUTS_MAX_DAYS:
            warn(f"derived.waccInputs.{k}: {label} de {wi[k]} ({(today-d_).days} dias): atualizar na tarefa mensal")
    sp = wi.get("ratingSpreadsPct")
    if not (isinstance(sp, dict) and sp and all(isnum(v) and 0 <= v <= 30 for v in sp.values())):
        err("derived.waccInputs.ratingSpreadsPct inválido")
    betas = wi.get("betas") or {}
    for t in TICKERS:
        b = betas.get(t)
        if not (isinstance(b, dict) and isnum(b.get("beta")) and 0 < b["beta"] <= 5):
            err(f"derived.waccInputs.betas.{t} ausente ou fora de (0, 5]")
            continue
        https(f"betas.{t}.source", b.get("source"))
        bd = pdate(b.get("asOf") or "", f"derived.waccInputs.betas.{t}.asOf")
        if bd and bd > today:
            err(f"derived.waccInputs.betas.{t}.asOf {b['asOf']} está no futuro")
        elif bd and (today - bd).days > WACC_BETA_MAX_DAYS:
            warn(f"derived.waccInputs.betas.{t}: beta de {b['asOf']} ({(today-bd).days} dias): atualizar")


def check_sbc_ev(der, today):
    """derived.sbcTTM e derived.evAdjust (opcionais, por empresa): presentes e malformados são erro; dados com mais de SBC_MAX_DAYS, aviso."""
    def https(where, s):
        if not (isinstance(s, dict) and s.get("label") and str(s.get("url", "")).startswith("https://")):
            err(f"{where}: fonte precisa de label e url https")

    def dated(where, e):
        d_ = pdate(e.get("asOf") or "", f"{where}.asOf")
        if d_ and d_ > today:
            err(f"{where}.asOf {e['asOf']} está no futuro")
        elif d_ and (today - d_).days > SBC_MAX_DAYS:
            warn(f"{where}: dado de {e['asOf']} ({(today-d_).days} dias): atualizar na incorporação do trimestre")

    for key, fields in (("sbcTTM", ("valueB",)), ("evAdjust", ("opLeaseB", "finLeaseB", "nciB"))):
        blk = der.get(key)
        if blk is None:
            continue
        if not isinstance(blk, dict):
            err(f"derived.{key} deve ser um objeto por ticker")
            continue
        for t, e in blk.items():
            where = f"derived.{key}.{t}"
            if t not in TICKERS:
                err(f"{where}: ticker desconhecido")
                continue
            if not isinstance(e, dict):
                err(f"{where} deve ser um objeto")
                continue
            for f in fields:
                lo_ok = e.get(f) is not None and isnum(e[f]) and (e[f] > 0 if key == "sbcTTM" else e[f] >= 0)
                if not (lo_ok and e[f] <= 500):
                    err(f"{where}.{f} fora do intervalo esperado: {e.get(f)!r}")
            https(f"{where}.source", e.get("source"))
            dated(where, e)


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

    # --- consistência trimestral: rótulos x séries x textos fixos da UI (pega o que a tarefa mensal pode esquecer)
    mq = re.match(r"Q([1-4]) (\d{4})$", m.get("quarterLabel", ""))
    if not mq:
        err(f"meta.quarterLabel inválido: {m.get('quarterLabel')!r} (esperado 'Qn AAAA')")
    else:
        qn, qy = int(mq.group(1)), int(mq.group(2))
        want = f"Q{qn}'{qy % 100:02d}"
        if m["historyLabels"][-1] != want:
            err(f"historyLabels termina em {m['historyLabels'][-1]!r}, mas quarterLabel={m['quarterLabel']!r} (esperado {want!r})")
        ui = sorted(p for p in glob.glob(C_path("web/src/ui/*.ts")) if not p.endswith(".test.ts"))
        if not ui:
            warn("web/src/ui ausente: textos editoriais fixos não verificados")
        else:
            txt = "\n".join(open(p, encoding="utf-8").read() for p in ui)
            seen = [(int(y), int(q)) for q, y in re.findall(r"\b([1-4])T ?(20\d\d)\b", txt)]
            seen += [(int(y), int(q)) for q, y in re.findall(r"\bQ([1-4]) (20\d\d)\b", txt)]
            if seen and max(seen) < (qy, qn):
                warn(f"web/src/ui cita no máximo {max(seen)[1]}T {max(seen)[0]}, mas o painel está em {m['quarterLabel']}: revisar rótulos/textos editoriais fixos na UI")

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

    check_provenance(m, today)
    check_shares(comps, der)
    check_wacc(der, today)
    check_sbc_ev(der, today)

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
