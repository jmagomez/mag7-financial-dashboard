"""Constantes e utilitários compartilhados por validate.py, send_email.py e daily.py.

Fonte única de: tickers, limiar de alerta de CDS, recuperação (R) da PD implícita,
leitura de JSON, glossário de siglas (glossary.json, o mesmo arquivo lido pelo dashboard)
e a junção dos dois arquivos de dados:
  data.json          -> dados DIÁRIOS (preço, market cap, peso, CDS, briefing, auditoria, nota de CDS)
  fundamentals.json  -> dados TRIMESTRAIS/estáticos (resultados, histórico, rating, derived, fontes)
merge() devolve o formato único que validate.py, send_email.py e o dashboard consomem.
"""
import json
import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TICKERS = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA"]
NAMES = {"AAPL": "Apple", "MSFT": "Microsoft", "NVDA": "Nvidia", "GOOGL": "Alphabet",
         "AMZN": "Amazon", "META": "Meta", "TSLA": "Tesla"}
CDS_ALERT = 100      # bps: acima disso a Mag 7 vira alerta (painel, e-mail, briefing)
CDS_R = 0.40         # recuperação assumida na PD implícita
CDS_LOG_KEEP = 6     # entradas de meta.cdsLog mantidas em data.json (as antigas ficam no histórico do git)
# Proveniência (meta.provenance): primary = emissor/bolsa/SEC; secondary = agregador ou imprensa; derived = calculado de outros valores.
TIERS = ("primary", "secondary", "derived")
SHARES_ANCHOR_MAX_DAYS = 90   # market cap diário = preço × ações da capa do 10-Q/10-K; se a mais antiga passar disso, avisa para atualizar derived.sharesOut
WACC_INPUTS_MAX_DAYS = 45      # juro livre e prêmio de risco de derived.waccInputs: acima disso, aviso (atualizar na tarefa mensal)
WACC_BETA_MAX_DAYS = 120      # betas de derived.waccInputs: acima disso, aviso
SBC_MAX_DAYS = 180             # SBC TTM (derived.sbcTTM) e arrendamentos (derived.evAdjust): acima disso, aviso (atualizar na incorporação do trimestre)
CDS_STALE_DAYS = 30           # cotação de CDS com mais de N dias é "defasada" (mesmo limite do painel e do validador)
SHARES_DIVERGENCE_WARN = 2    # % entre as ações usadas no market cap (market cap ÷ preço) e as reportadas; acima disso, aviso (ação desatualizada ou desdobramento)


def path(*p):
    return os.path.join(ROOT, *p)


def load(rel, default=None):
    try:
        with open(path(rel), encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def pd5(bps):
    """PD acumulada em 5 anos implícita no CDS (taxa de risco constante, neutra ao risco), em %."""
    return None if bps is None else (1 - math.exp(-5 * (bps / 1e4) / (1 - CDS_R))) * 100


def shares_reported(fund):
    """Ações em circulação (milhões) da capa do último 10-Q/10-K, de fundamentals.json: {ticker: {asOf, total, ...}}.

    Levanta SystemExit se faltar algum dos 7 tickers, total inválido ou data fora de AAAA-MM-DD (nada é inventado)."""
    sh = ((fund or {}).get("derived") or {}).get("sharesOut") or {}
    missing = [t for t in TICKERS if t not in sh]
    if missing:
        raise SystemExit(f"fundamentals.json: derived.sharesOut sem {missing}")
    for t in TICKERS:
        e = sh[t]
        ok = isinstance(e.get("total"), (int, float)) and not isinstance(e.get("total"), bool) and e["total"] > 0
        if not ok or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(e.get("asOf", ""))):
            raise SystemExit(f"fundamentals.json: derived.sharesOut.{t} precisa de total > 0 e asOf AAAA-MM-DD")
    return {t: sh[t] for t in TICKERS}


def cds_quality(meta, comps, ref_date):
    """Qualidade dos CDS das Mag 7 em `ref_date` (AAAA-MM-DD): quantos têm cotação, idade média/máxima em dias e quantos passam de CDS_STALE_DAYS.

    Só conta CDS com nível e data (`meta.cdsAsOf`); sem nenhum, devolve None (nada é inventado). Referências fora das Mag 7 não entram."""
    from datetime import date
    ref = date.fromisoformat(ref_date)
    ages = []
    for c in comps:
        dt = (meta.get("cdsAsOf") or {}).get(c["ticker"])
        if c.get("cds") is not None and dt:
            ages.append((ref - date.fromisoformat(dt)).days)
    if not ages:
        return None
    return {"cdsCount": len(ages), "cdsAvgAgeDays": round(sum(ages) / len(ages), 1), "cdsMaxAgeDays": max(ages),
            "cdsStale": sum(1 for a in ages if a > CDS_STALE_DAYS)}


def glossary():
    g = load("glossary.json", {})
    return {k: v for k, v in g.items() if not k.startswith("_")}


def acronyms_in(text, gloss=None):
    """Siglas do glossário citadas em `text`, na ordem de aparição."""
    gloss = gloss if gloss is not None else glossary()
    found = []
    for k in sorted(gloss, key=len, reverse=True):
        for m in re.finditer(r"(?<![A-Za-z0-9_])" + re.escape(k) + r"(?![A-Za-z0-9_])", text):
            found.append((m.start(), k))
    seen, out = set(), []
    for _, k in sorted(found):
        if k not in seen:
            seen.add(k)
            out.append(k)
    return out


PRICE_SRC_MARK = "$priceSource"   # marcador em fundamentals.sources: posição da fonte de preços do dia


# Blocos de `derived` com um número por empresa, todos no formato v2 {value, asOf, tier, source} (Fase 3).
SCALAR_DERIVED = ("fcfTTM", "fwdPE", "ebitdaImplB", "fwdEPS", "oneOffTTM")


def value_of(x):
    """Valor numérico de um campo escalar de `derived` no formato v2 ({"value": n, ...}); qualquer outra coisa → None."""
    return x.get("value") if isinstance(x, dict) else None


def unwrap_derived(der):
    """Cópia de `derived` com os blocos escalares reduzidos a um número por empresa (o que validate, e-mail e CSV leem).

    Número solto (formato antigo) é erro: falha alto, em vez de aceitar um dado sem data, nível e fonte.
    """
    if not isinstance(der, dict):
        return der
    out = dict(der)
    for blk in SCALAR_DERIVED:
        if isinstance(der.get(blk), dict):
            soltos = [t for t, v in der[blk].items() if not isinstance(v, dict)]
            if soltos:
                raise ValueError(f"derived.{blk}: número solto em {', '.join(soltos)}; use {{value, asOf, tier, source}}")
            out[blk] = {t: value_of(v) for t, v in der[blk].items() if value_of(v) is not None}
    return out


def merge(d, f):
    """Junta data.json (diário) e fundamentals.json (trimestral) no formato único.

    Tolerante: se `d` já estiver no formato antigo (empresas com 'annual'), devolve `d` como está.
    """
    if f is None or (d.get("companies") and "annual" in d["companies"][0]):
        return d
    dm, fm = d["meta"], f["meta"]
    m = {**fm, **dm}
    notes = list(fm["notes"])
    notes.insert(1, dm["priceNote"])
    credit = list(fm["creditNotes"])
    credit.insert(3, dm["cdsNote"])
    m["notes"], m["creditNotes"] = notes, credit
    m.pop("priceNote", None)
    m.pop("cdsNote", None)
    dc = {c["ticker"]: c for c in d["companies"]}
    comps = [{**fc, **dc.get(fc["ticker"], {})} for fc in f["companies"]]
    ps = d.get("priceSource")
    sources = [ps if (s.get(PRICE_SRC_MARK) and ps) else s for s in f["sources"] if ps or not s.get(PRICE_SRC_MARK)]
    return {"meta": m, "companies": comps, "derived": unwrap_derived(f.get("derived", {})), "sources": sources}


def load_data():
    """Dados completos (diário + trimestral) no formato único."""
    return merge(load("data.json"), load("fundamentals.json"))
