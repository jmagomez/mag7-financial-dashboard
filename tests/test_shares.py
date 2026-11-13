"""derived.sharesOut (fundamentals.json): ações reportadas na capa do 10-Q/10-K, só para conferir as implícitas do market cap.
A divergência implícitas × reportadas NÃO é testada aqui: ela aparece como aviso no rodapé do painel (um CI vermelho por arredondamento seria ruído)."""
from datetime import date

import common as C


def _sh():
    return C.load("fundamentals.json")["derived"]["sharesOut"]


def test_sete_empresas_com_fonte_https_e_data_valida():
    sh = _sh()
    assert sorted(sh) == sorted(C.TICKERS)
    for t, e in sh.items():
        assert e["total"] > 0 and e["form"], t
        assert e["source"]["url"].startswith("https://") and e["source"]["label"], t
        assert date.fromisoformat(e["asOf"]) <= date.today(), t


def test_classes_somam_o_total_com_tolerancia_da_capa():
    for t, e in _sh().items():
        if "classes" in e:
            assert abs(sum(e["classes"].values()) / e["total"] - 1) <= 0.001, t
