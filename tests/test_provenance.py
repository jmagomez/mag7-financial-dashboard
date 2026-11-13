"""meta.provenance: gravado por daily.py, validado por validate.py e descrito no schema (aditivo, sem mudar campos existentes)."""
import copy
import json
from datetime import date

import pytest
from jsonschema import Draft202012Validator

import common as C
import daily
import validate


@pytest.fixture()
def base():
    return C.load("data.json"), C.load("history/snapshots.json")


def _delta(d, **extra):
    delta = {"tradeDate": "2099-01-01", "today": "2099-01-02",
             "prices": {c["ticker"]: c["price"] for c in d["companies"]}, "cdsLog": "teste", "snapshotNote": "teste"}
    delta.update(extra)
    return delta


def _run(base, **extra):
    d, s = copy.deepcopy(base[0]), copy.deepcopy(base[1])
    return daily.apply(d, s, _delta(d, **extra))[0]


def _issues(m, today=date(2099, 1, 2)):
    validate.errors.clear()
    validate.warnings.clear()
    validate.check_provenance(m, today)
    return list(validate.errors), list(validate.warnings)


def test_acoes_reportadas_vem_de_fundamentals_e_recusa_lacuna():
    fund = C.load("fundamentals.json")
    assert set(C.shares_reported(fund)) == set(C.TICKERS)
    bad = copy.deepcopy(fund)
    del bad["derived"]["sharesOut"]["TSLA"]
    with pytest.raises(SystemExit):
        C.shares_reported(bad)
    bad = copy.deepcopy(fund)
    bad["derived"]["sharesOut"]["AAPL"]["asOf"] = "ontem"
    with pytest.raises(SystemExit):
        C.shares_reported(bad)


def test_daily_grava_proveniencia_completa(base):
    out = _run(base)
    m = out["meta"]
    pv = m["provenance"]
    assert pv["prices"] == {"tier": "secondary", "asOf": "2099-01-01", "source": out["priceSource"]["label"]}
    assert pv["marketCapB"]["tier"] == "derived" and pv["marketCapB"]["asOf"] == "2099-01-01"
    sh = C.shares_reported(C.load("fundamentals.json"))
    assert pv["marketCapB"]["anchor"] == {"date": min(e["asOf"] for e in sh.values()), "source": "capas dos 10-Q/10-K (a mais antiga)"}
    assert "10-Q/10-K" in pv["marketCapB"]["method"]
    assert pv["weight"]["tier"] == "derived"
    with_level = {c["ticker"] for c in base[0]["companies"] if c["cds"] is not None} | {r["ticker"] for r in base[0]["meta"]["cdsRef"] if r["cds"] is not None}
    assert set(pv["cds"]) == with_level
    assert all(pv["cds"][t] == {"tier": "secondary", "asOf": m["cdsAsOf"][t]} for t in with_level)


def test_nao_muda_nenhum_campo_existente(base):
    com = _run(base)
    d, s = copy.deepcopy(base[0]), copy.deepcopy(base[1])
    sem = copy.deepcopy(com)
    sem["meta"].pop("provenance")
    antigo = copy.deepcopy(d)
    daily.apply(antigo, s, _delta(d))
    antigo["meta"].pop("provenance")
    assert json.dumps(sem, sort_keys=True) == json.dumps(antigo, sort_keys=True)


def test_reexecucao_preserva_tier_de_precos_e_sharesanchor_foi_aposentado(base):
    d1 = _run(base, priceTier="primary")
    s = copy.deepcopy(base[1])
    d2, _ = daily.apply(d1, s, _delta(d1))  # sem priceTier: mantém o anterior
    assert d2["meta"]["provenance"]["prices"]["tier"] == "primary"
    with pytest.raises(SystemExit):
        _run(base, sharesAnchor={"date": "2099-01-01", "source": "10-Q"})


def test_tier_do_cds_so_persiste_enquanto_a_cotacao_nao_muda(base):
    d1 = _run(base, cds={"META": {"bps": 125, "asOf": "2099-01-01", "tier": "primary"}})
    assert d1["meta"]["provenance"]["cds"]["META"] == {"tier": "primary", "asOf": "2099-01-01"}
    d2, _ = daily.apply(d1, copy.deepcopy(base[1]), _delta(d1))
    assert d2["meta"]["provenance"]["cds"]["META"]["tier"] == "primary"  # mesma cotação
    d3, _ = daily.apply(d2, copy.deepcopy(base[1]), _delta(d2, cds={"META": {"bps": 130, "asOf": "2099-01-02"}}))
    assert d3["meta"]["provenance"]["cds"]["META"] == {"tier": "secondary", "asOf": "2099-01-02"}  # cotação nova, sem declaração


@pytest.mark.parametrize("extra", [{"priceTier": "ouro"}, {"cds": {"META": {"bps": 1, "asOf": "2099-01-01", "tier": "x"}}},
                                   {"sharesAnchor": {"date": "ontem", "source": "x"}}, {"sharesAnchor": {"date": "2099-01-01"}}])
def test_entradas_invalidas_sao_recusadas(base, extra):
    with pytest.raises(SystemExit):
        _run(base, **extra)


def test_schema_aceita_e_rejeita(base):
    schema = json.load(open(C.path("schemas/data.schema.json"), encoding="utf-8"))
    v = Draft202012Validator(schema)
    ok = _run(base)
    assert [e.message for e in v.iter_errors(ok)] == []
    bad = copy.deepcopy(ok)
    bad["meta"]["provenance"]["prices"]["tier"] = "ouro"
    del bad["meta"]["provenance"]["weight"]
    msgs = " | ".join(e.message for e in v.iter_errors(bad))
    assert "ouro" in msgs and "weight" in msgs


def test_validate_ausente_nao_avisa_e_valido_passa(base):
    assert _issues({"marketSnapshot": "2099-01-01"}) == ([], [])
    m = _run(base)["meta"]
    m["provenance"]["marketCapB"]["anchor"]["date"] = "2098-12-01"
    assert _issues(m) == ([], [])


def test_validate_pega_estrutura_errada(base):
    m = _run(base)["meta"]
    m["provenance"]["prices"]["tier"] = "ouro"
    m["provenance"]["marketCapB"]["tier"] = "secondary"
    m["provenance"]["weight"]["asOf"] = "2098-12-31"
    m["provenance"]["cds"]["META"]["asOf"] = "2000-01-01"
    errs, _ = _issues(m)
    txt = " | ".join(errs)
    assert "prices.tier" in txt and "marketCapB.tier deve ser" in txt and "weight.asOf" in txt and "cds.META.asOf" in txt


def test_validate_avisa_ancora_ausente_ou_velha(base):
    m = _run(base)["meta"]
    m["provenance"]["marketCapB"]["anchor"]["date"] = "2098-09-01"
    _, w = _issues(m)
    assert any("atualizar derived.sharesOut" in x for x in w)
    del m["provenance"]["marketCapB"]["anchor"]
    errs, w = _issues(m)
    assert errs == [] and any("sem âncora" in x for x in w)
    m["provenance"]["marketCapB"]["anchor"] = {"date": "2098-12-01", "source": "x"}
    assert _issues(m) == ([], [])  # 32 dias: dentro do limite de 90


def test_validate_avisa_quando_acoes_do_market_cap_divergem_das_reportadas():
    comps = [{"ticker": "AAA", "price": 10.0, "marketCapB": 1.0}, {"ticker": "BBB", "price": 10.0, "marketCapB": 1.05}]
    der = {"sharesOut": {"AAA": {"total": 100, "asOf": "2026-10-01"}, "BBB": {"total": 100, "asOf": "2026-10-01"}}}
    validate.errors.clear()
    validate.warnings.clear()
    validate.check_shares(comps, der)
    assert validate.errors == [] and len(validate.warnings) == 1 and "BBB" in validate.warnings[0]
    validate.warnings.clear()
    validate.check_shares(comps, {})  # sem derived.sharesOut: nada a conferir
    assert validate.warnings == []
