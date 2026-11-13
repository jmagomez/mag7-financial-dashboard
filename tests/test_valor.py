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


EBITDA_IMPL_ANTES = {"AAPL": 157.4, "MSFT": 241.5, "NVDA": 183.3, "GOOGL": 161.9, "AMZN": 161.9, "META": 98.6, "TSLA": 9.3}


def test_ebitdaimplb_v2_mesmos_numeros_e_proveniencia_completa():
    """ebitdaImplB no formato v2 não muda nenhum número; tier 'derived' (reescalado do múltiplo)."""
    raw = common.load("fundamentals.json")["derived"]["ebitdaImplB"]
    assert {t: value_of(v) for t, v in raw.items()} == EBITDA_IMPL_ANTES
    assert common.merge(common.load("data.json"), common.load("fundamentals.json"))["derived"]["ebitdaImplB"] == EBITDA_IMPL_ANTES
    for v in raw.values():
        assert v["tier"] == "derived"
        assert len(v["asOf"]) == 10 and v["source"]["url"].startswith("https://") and v["source"]["label"]


BALANCE_ANTES = {"AAPL": (146.5, 84.3), "MSFT": (76.8, 40.3), "NVDA": (56.6, 33.4), "GOOGL": (242.5, 98.2),
                 "AMZN": (123.0, 128.9), "META": (90.3, 83.7), "TSLA": (37.0, 7.0)}


def test_balance_v2_mesmos_numeros_e_proveniencia_completa():
    """balanceQ2_2026 com asOf/tier/source: cash e debt seguem como chaves diretas e nenhum número muda."""
    raw = common.load("fundamentals.json")["derived"]["balanceQ2_2026"]
    assert {t: (b["cash"], b["debt"]) for t, b in raw.items()} == BALANCE_ANTES
    merged = common.merge(common.load("data.json"), common.load("fundamentals.json"))["derived"]["balanceQ2_2026"]
    assert {t: (b["cash"], b["debt"]) for t, b in merged.items()} == BALANCE_ANTES
    for t, b in raw.items():
        assert b["tier"] == ("derived" if t == "TSLA" else "primary")
        assert len(b["asOf"]) == 10 and b["source"]["url"].startswith("https://") and b["source"]["label"]


FWD_PE_ANTES = {"AAPL": 34, "MSFT": 20, "NVDA": 18, "GOOGL": 23, "AMZN": 31, "META": 14, "TSLA": 188}


def test_fwdpe_v2_mesmos_numeros_e_proveniencia_completa():
    """fwdPE no formato v2 não muda nenhum número; tier 'secondary' (agregador, valor como publicado)."""
    raw = common.load("fundamentals.json")["derived"]["fwdPE"]
    assert {t: value_of(v) for t, v in raw.items()} == FWD_PE_ANTES
    assert common.merge(common.load("data.json"), common.load("fundamentals.json"))["derived"]["fwdPE"] == FWD_PE_ANTES
    for v in raw.values():
        assert v["tier"] == "secondary"
        assert len(v["asOf"]) == 10 and v["source"]["url"].startswith("https://") and v["source"]["label"]


FWD_EPS_ANTES = {"AAPL": 9.16, "MSFT": 24.97, "NVDA": 12.46, "GOOGL": 14.67, "AMZN": 8.31, "META": 41.62, "TSLA": 1.86}


def test_fwdeps_v2_mesmos_numeros_e_proveniencia_completa():
    """fwdEPS no formato v2 não muda nenhum número; tier 'derived' (preço ÷ P/E forward)."""
    raw = common.load("fundamentals.json")["derived"]["fwdEPS"]
    assert {t: value_of(v) for t, v in raw.items()} == FWD_EPS_ANTES
    assert common.merge(common.load("data.json"), common.load("fundamentals.json"))["derived"]["fwdEPS"] == FWD_EPS_ANTES
    for v in raw.values():
        assert v["tier"] == "derived"
        assert len(v["asOf"]) == 10 and v["source"]["url"].startswith("https://") and v["source"]["label"]
