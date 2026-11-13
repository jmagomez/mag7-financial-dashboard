"""Fase 3: validação dos blocos de derived no formato v2 (asOf, tier, source obrigatórios)."""
import copy
from datetime import date

import common as C
import validate

HOJE = date(2026, 11, 13)


def _check(der, today=HOJE):
    validate.errors.clear()
    validate.warnings.clear()
    validate.check_v2_blocks(der, today)
    return list(validate.errors), list(validate.warnings)


def _real():
    return copy.deepcopy(C.load("fundamentals.json")["derived"])


def test_arquivo_real_passa_sem_erro_nem_aviso():
    assert _check(_real()) == ([], [])


def test_numero_solto_em_bloco_migrado_e_erro():
    der = _real()
    der["fcfTTM"]["AAPL"] = 108
    errs, _ = _check(der)
    assert errs == ["derived.fcfTTM.AAPL: precisa do formato v2 (objeto com asOf, tier e source), não número solto"]


def test_tier_invalido_data_ruim_e_fonte_sem_https():
    der = _real()
    der["oneOffTTM"]["MSFT"]["tier"] = "estimado"
    der["ebitdaImplB"]["AAPL"]["asOf"] = "27/08/2026"
    der["balanceQ2_2026"]["TSLA"]["source"]["url"] = "http://exemplo.com"
    errs, _ = _check(der)
    assert any("oneOffTTM.MSFT.tier" in e for e in errs)
    assert any("ebitdaImplB.AAPL.asOf" in e for e in errs)
    assert any("balanceQ2_2026.TSLA.source" in e for e in errs)


def test_data_no_futuro_e_erro_e_dado_velho_e_aviso():
    der = _real()
    der["fcfTTM"]["MSFT"]["asOf"] = "2026-12-01"
    errs, _ = _check(der)
    assert any("fcfTTM.MSFT.asOf 2026-12-01 está no futuro" in e for e in errs)
    errs, warns = _check(_real(), today=date(2027, 1, 15))
    assert errs == []
    assert any("fcfTTM.AAPL" in w for w in warns)


def test_blocos_nao_migrados_continuam_com_numero_solto():
    der = _real()
    assert all(isinstance(v, (int, float)) for v in der["fwdPE"].values())
    assert all(isinstance(v, (int, float)) for v in der["fwdEPS"].values())
    assert _check(der) == ([], [])
