"""E-mail: linha de qualidade dos dados (nível dos preços e idade dos CDS), na mesma medida do rodapé do painel."""
import copy
from datetime import date

import common as C
import send_email as S


def _build(monkeypatch, mutate=None):
    d = copy.deepcopy(C.load_data())
    if mutate:
        mutate(d)
    monkeypatch.setattr(S, "today_br", lambda: date(2026, 11, 13))
    return S.build(d, S.load_snapshots())


def test_linha_de_qualidade_no_html_e_no_texto(monkeypatch):
    def mut(d):
        d["meta"]["provenance"] = {"prices": {"tier": "secondary", "asOf": "2026-11-12"}}
        d["meta"]["cdsAsOf"].update({"MSFT": "2026-11-12", "NVDA": "2026-11-03", "GOOGL": "2026-09-01"})
        for c in d["companies"]:
            c["cds"] = {"MSFT": 53, "NVDA": 139, "GOOGL": 67}.get(c["ticker"])
    _, text, html, _ = _build(monkeypatch, mut)
    # idades em 13/11: MSFT 1, NVDA 10, GOOGL 73 → média 28,0; máx. 73; 1 defasado
    frase = "preços de nível secundário (agregador ou imprensa); CDS: 3 cotações, idade média 28,0 d (máx. 73 d), 1 com mais de 30 d."
    assert "Qualidade dos dados: " + frase in text
    assert "<b>Qualidade dos dados:</b> " + frase.replace("(", "(") in html


def test_sem_proveniencia_nem_cds_nao_inventa_nada(monkeypatch):
    def mut(d):
        d["meta"].pop("provenance", None)
        for c in d["companies"]:
            c["cds"] = None
    _, text, html, _ = _build(monkeypatch, mut)
    assert "Qualidade dos dados" not in text and "Qualidade dos dados" not in html
