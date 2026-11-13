"""Fase 3, passo 1: leitor duplo de `derived` (número simples ou {value, ...}); nenhuma mudança de dados."""
import copy
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
import common  # noqa: E402
from common import SCALAR_DERIVED, unwrap_derived, value_of  # noqa: E402

SRC = {"label": "10-Q", "url": "https://www.sec.gov/"}


def _wrap(der):
    out = copy.deepcopy(der)
    for blk in SCALAR_DERIVED:
        out[blk] = {t: {"value": v, "asOf": "2026-06-30", "tier": "primary", "source": SRC} for t, v in der[blk].items()}
    return out


def test_value_of_aceita_os_dois_formatos():
    assert value_of(12.5) == 12.5
    assert value_of({"value": 12.5, "asOf": "2026-06-30"}) == 12.5
    assert value_of(0) == 0
    assert value_of({}) is None
    assert value_of(None) is None


def test_unwrap_e_idempotente():
    base = unwrap_derived(common.load("fundamentals.json")["derived"])
    assert unwrap_derived(base) == base
    assert all(isinstance(v, (int, float)) for blk in SCALAR_DERIVED for v in base[blk].values())


def test_formato_v2_equivale_ao_antigo():
    base = unwrap_derived(common.load("fundamentals.json")["derived"])
    assert unwrap_derived(_wrap(base)) == base


def test_merge_entrega_formato_antigo_mesmo_com_v2():
    d, f = common.load("data.json"), common.load("fundamentals.json")
    base = unwrap_derived(f["derived"])
    f2 = copy.deepcopy(f)
    f2["derived"] = _wrap(base)
    assert common.merge(d, f2) == common.merge(d, f)
    assert json.dumps(common.merge(d, f)["derived"], sort_keys=True) == json.dumps(base, sort_keys=True)


FCF_TTM_ANTES = {"AAPL": 108, "MSFT": 67, "NVDA": 127, "GOOGL": 53, "AMZN": -7.6, "META": 40, "TSLA": 5.8}


def test_fcfttm_v2_mesmos_numeros_e_proveniencia_completa():
    """Passo 2: fcfTTM no formato v2 não muda nenhum número e traz data, nível e fonte https por empresa."""
    raw = common.load("fundamentals.json")["derived"]["fcfTTM"]
    assert {t: value_of(v) for t, v in raw.items()} == FCF_TTM_ANTES
    assert common.merge(common.load("data.json"), common.load("fundamentals.json"))["derived"]["fcfTTM"] == FCF_TTM_ANTES
    for v in raw.values():
        assert v["tier"] in common.TIERS
        assert len(v["asOf"]) == 10 and v["source"]["url"].startswith("https://") and v["source"]["label"]


ONE_OFF_TTM_ANTES = {"MSFT": 3.2, "GOOGL": 77.1, "AMZN": 60, "META": -15.9}


def test_oneoffttm_v2_mesmos_numeros_e_proveniencia_completa():
    """Passo 3: oneOffTTM no formato v2 não muda nenhum número; tier 'derived' (ajuste estimado)."""
    raw = common.load("fundamentals.json")["derived"]["oneOffTTM"]
    assert {t: value_of(v) for t, v in raw.items()} == ONE_OFF_TTM_ANTES
    assert common.merge(common.load("data.json"), common.load("fundamentals.json"))["derived"]["oneOffTTM"] == ONE_OFF_TTM_ANTES
    for v in raw.values():
        assert v["tier"] == "derived"
        assert len(v["asOf"]) == 10 and v["source"]["url"].startswith("https://") and v["source"]["label"]
