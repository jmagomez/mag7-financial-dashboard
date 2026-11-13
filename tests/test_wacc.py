"""derived.waccInputs: estrutura validada por validate.py e coerência com o resto de fundamentals.json."""
import copy
from datetime import date

import common as C
import validate


def _check(der, today=date(2026, 11, 13)):
    validate.errors.clear()
    validate.warnings.clear()
    validate.check_wacc(der, today)
    return list(validate.errors), list(validate.warnings)


def _real():
    return copy.deepcopy(C.load("fundamentals.json")["derived"])


def test_arquivo_real_tem_as_entradas_e_passa():
    der = _real()
    assert set(der["waccInputs"]["betas"]) == set(C.TICKERS)
    assert _check(der) == ([], [])


def test_toda_empresa_tem_rating_com_spread():
    f = C.load("fundamentals.json")
    table = f["derived"]["waccInputs"]["ratingSpreadsPct"]
    for c in f["companies"]:
        sp = c["rating"]["sp"].replace("−", "-")
        assert sp in table or sp.rstrip("+-") in table, (c["ticker"], sp)


def test_ausente_nao_avisa():
    der = _real()
    del der["waccInputs"]
    assert _check(der) == ([], [])


def test_erros_de_estrutura():
    der = _real()
    w = der["waccInputs"]
    w["rfPct"] = 50
    w["erpSource"] = {"label": "x", "url": "http://inseguro"}
    del w["betas"]["TSLA"]
    w["betas"]["AAPL"]["asOf"] = "2099-01-01"
    errs, _ = _check(der)
    txt = " | ".join(errs)
    assert "rfPct" in txt and "erpSource" in txt and "betas.TSLA" in txt and "betas.AAPL.asOf" in txt


def test_avisa_entradas_velhas():
    der = _real()
    _, warns = _check(der, today=date(2027, 4, 1))
    txt = " | ".join(warns)
    assert "rfPct" in txt and "erpPct" in txt and "beta de" in txt
