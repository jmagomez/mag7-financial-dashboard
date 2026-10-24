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
    return {"meta": m, "companies": comps, "derived": f.get("derived", {}), "sources": sources}


def load_data():
    """Dados completos (diário + trimestral) no formato único."""
    return merge(load("data.json"), load("fundamentals.json"))
