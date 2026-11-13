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


def test_dados_atuais_ficam_identicos():
    der = common.load("fundamentals.json")["derived"]
    assert unwrap_derived(der) == der


def test_formato_v2_equivale_ao_antigo():
    der = common.load("fundamentals.json")["derived"]
    assert unwrap_derived(_wrap(der)) == der


def test_merge_entrega_formato_antigo_mesmo_com_v2():
    d, f = common.load("data.json"), common.load("fundamentals.json")
    f2 = copy.deepcopy(f)
    f2["derived"] = _wrap(f["derived"])
    assert common.merge(d, f2) == common.merge(d, f)
    assert json.dumps(common.merge(d, f)["derived"], sort_keys=True) == json.dumps(f["derived"], sort_keys=True)
