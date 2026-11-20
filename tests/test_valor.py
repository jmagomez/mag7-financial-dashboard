"""Fase 3: leitor dos blocos escalares de `derived` (formato v2 {value, asOf, tier, source}); número solto é erro."""
import copy
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
import common  # noqa: E402
from common import SCALAR_DERIVED, unwrap_derived, value_of  # noqa: E402

SRC = {"label": "10-Q", "url": "https://www.sec.gov/"}


def _wrap(der):
    out = copy.deepcopy(der)
    for blk in SCALAR_DERIVED:
        out[blk] = {t: {"value": v, "asOf": "2026-06-30", "tier": "primary", "source": SRC} for t, v in der[blk].items()}
    return out


def test_value_of_so_aceita_o_objeto_v2():
    assert value_of({"value": 12.5, "asOf": "2026-06-30"}) == 12.5
    assert value_of({"value": 0}) == 0
    for x in (12.5, 0, {}, None, "3", [1]):
        assert value_of(x) is None


def test_unwrap_entrega_um_numero_por_empresa():
    base = unwrap_derived(common.load("fundamentals.json")["derived"])
    for blk in SCALAR_DERIVED:
        assert base[blk] and all(isinstance(v, (int, float)) for v in base[blk].values())


def test_unwrap_ignora_a_proveniencia():
    base = unwrap_derived(common.load("fundamentals.json")["derived"])
    assert unwrap_derived(_wrap(base)) == base


def test_numero_solto_e_erro_com_bloco_e_empresas():
    der = copy.deepcopy(common.load("fundamentals.json")["derived"])
    der["fcfTTM"]["AAPL"] = 108
    der["fcfTTM"]["MSFT"] = 67
    with pytest.raises(ValueError, match=r"derived\.fcfTTM: número solto em AAPL, MSFT"):
        unwrap_derived(der)


def test_empresa_sem_value_fica_de_fora():
    der = {"fcfTTM": {"AAPL": {"asOf": "2026-06-30"}, "MSFT": {"value": 67}}}
    assert unwrap_derived(der)["fcfTTM"] == {"MSFT": 67}


def test_merge_entrega_formato_antigo_mesmo_com_v2():
    d, f = common.load("data.json"), common.load("fundamentals.json")
    base = unwrap_derived(f["derived"])
    f2 = copy.deepcopy(f)
    f2["derived"] = _wrap(base)
    assert common.merge(d, f2) == common.merge(d, f)
    assert json.dumps(common.merge(d, f)["derived"], sort_keys=True) == json.dumps(base, sort_keys=True)


BLOCOS_V2 = {"fcfTTM": None, "oneOffTTM": "derived", "ebitdaImplB": "derived", "fwdPE": "secondary", "fwdEPS": "derived"}


@pytest.mark.parametrize("blk,tier", BLOCOS_V2.items())
def test_bloco_escalar_v2_traz_proveniencia_completa_e_o_leitor_entrega_o_mesmo_valor(blk, tier):
    """Cada bloco escalar está em v2 (data, nível e fonte https por empresa) e merge() entrega exatamente o `value` gravado."""
    raw = common.load("fundamentals.json")["derived"][blk]
    assert raw
    merged = common.merge(common.load("data.json"), common.load("fundamentals.json"))["derived"][blk]
    assert merged == {t: value_of(v) for t, v in raw.items()}
    for v in raw.values():
        assert v["tier"] in common.TIERS and (tier is None or v["tier"] == tier)
        assert len(v["asOf"]) == 10 and v["source"]["url"].startswith("https://") and v["source"]["label"]


def test_balance_v2_cash_debt_diretos_e_proveniencia_completa():
    """balanceQ2_2026 tem asOf/tier/source e mantém cash e debt como chaves diretas, iguais depois do merge."""
    raw = common.load("fundamentals.json")["derived"]["balanceQ2_2026"]
    assert set(raw) == set(common.TICKERS)
    merged = common.merge(common.load("data.json"), common.load("fundamentals.json"))["derived"]["balanceQ2_2026"]
    assert {t: (b["cash"], b["debt"]) for t, b in merged.items()} == {t: (b["cash"], b["debt"]) for t, b in raw.items()}
    for b in raw.values():
        assert b["tier"] in common.TIERS and isinstance(b["cash"], (int, float)) and isinstance(b["debt"], (int, float))
        assert len(b["asOf"]) == 10 and b["source"]["url"].startswith("https://") and b["source"]["label"]
