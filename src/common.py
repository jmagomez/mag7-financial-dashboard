"""Constantes e utilitários compartilhados por validate.py, send_email.py e daily.py.

Fonte única de: tickers, limiar de alerta de CDS, recuperação (R) da PD implícita,
leitura de JSON e glossário de siglas (glossary.json, o mesmo arquivo lido pelo dashboard).
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
