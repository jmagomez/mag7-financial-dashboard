"""derived.sbcTTM e derived.evAdjust: estrutura validada por validate.py e coerência com o resto de fundamentals.json."""
import copy
from datetime import date

import common as C
import validate


def _check(der, today=date(2026, 11, 13)):
    validate.errors.clear()
    validate.warnings.clear()
    validate.check_sbc_ev(der, today)
    return list(validate.errors), list(validate.warnings)


def _real():
    return copy.deepcopy(C.load("fundamentals.json")["derived"])


def test_arquivo_real_passa_sem_erro_nem_aviso():
    der = _real()
    assert set(der["sbcTTM"]) == set(C.TICKERS)
    assert set(der["evAdjust"]) <= set(C.TICKERS)
    assert _check(der) == ([], [])


def test_sbc_bate_com_as_parcelas_do_texto():
    """O valor gravado é a conta das parcelas (US$ bi) escritas em `parts`: fica impossível mudar um sem o outro."""
    import re
    for t, e in _real()["sbcTTM"].items():
        nums = [float(x.replace(",", ".")) for x in re.findall(r"\d+,\d+", e["parts"])]
        if "12 meses publicados" in e["parts"] or "ano fiscal encerrado" in e["parts"]:
            assert abs(nums[0] - e["valueB"]) < 1e-9, t
        else:
            assert abs(nums[0] + nums[1] - nums[2] - e["valueB"]) < 0.0005, (t, nums, e["valueB"])


def test_sbc_menor_que_o_fcf_so_nas_empresas_esperadas():
    """Sanidade: SBC é pequeno frente ao market cap; pega erro de unidade (milhões no lugar de bilhões)."""
    f = C.load("fundamentals.json")
    d = C.load("data.json")
    mc = {c["ticker"]: c["marketCapB"] for c in d["companies"]}
    for t, e in f["derived"]["sbcTTM"].items():
        assert e["valueB"] / mc[t] < 0.05, t


def test_ausente_nao_avisa():
    der = _real()
    del der["sbcTTM"]
    del der["evAdjust"]
    assert _check(der) == ([], [])


def test_erros_de_estrutura():
    for mut, frag in (
        (lambda d: d["sbcTTM"]["AAPL"].update(valueB=0), "sbcTTM.AAPL.valueB"),
        (lambda d: d["sbcTTM"]["AAPL"].update(valueB=13706), "sbcTTM.AAPL.valueB"),
        (lambda d: d["sbcTTM"]["AAPL"].update(valueB="13,7"), "sbcTTM.AAPL.valueB"),
        (lambda d: d["sbcTTM"]["AAPL"]["source"].update(url="http://x"), "sbcTTM.AAPL.source"),
        (lambda d: d["sbcTTM"]["AAPL"].update(asOf="2026-13-01"), "sbcTTM.AAPL.asOf"),
        (lambda d: d["sbcTTM"]["AAPL"].update(asOf="2027-01-01"), "no futuro"),
        (lambda d: d["sbcTTM"].update(XXXX=copy.deepcopy(d["sbcTTM"]["AAPL"])), "ticker desconhecido"),
        (lambda d: d["evAdjust"]["AMZN"].update(finLeaseB=-1), "evAdjust.AMZN.finLeaseB"),
        (lambda d: d["evAdjust"]["AMZN"].pop("nciB"), "evAdjust.AMZN.nciB"),
        (lambda d: d.update(evAdjust=[]), "evAdjust deve ser"),
    ):
        der = _real()
        mut(der)
        errs, _ = _check(der)
        assert any(frag in e for e in errs), (frag, errs)


def test_dado_velho_avisa():
    der = _real()
    errs, warns = _check(der, today=date(2027, 2, 1))
    assert errs == []
    assert any("sbcTTM.MSFT" in w for w in warns) and any("evAdjust.AMZN" in w for w in warns)
