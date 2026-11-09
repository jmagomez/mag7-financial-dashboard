"""src/daily.py::apply — a parte numérica determinística (market cap por ações implícitas, pesos, cdsLog)."""
import copy

import pytest

import common as C
import daily


@pytest.fixture()
def base():
    return C.load("data.json"), C.load("history/snapshots.json")


def _delta(d, bump=1.01, trade="2099-01-01", today="2099-01-02"):
    return {"tradeDate": trade, "today": today,
            "prices": {c["ticker"]: round(c["price"] * bump, 2) for c in d["companies"]},
            "cdsLog": "teste", "snapshotNote": "teste"}


def test_market_cap_por_acoes_implicitas(base):
    d, s = copy.deepcopy(base[0]), copy.deepcopy(base[1])
    old = {c["ticker"]: (c["price"], c["marketCapB"]) for c in d["companies"]}
    delta = _delta(d)
    nd, _ = daily.apply(d, s, delta)
    for c in nd["companies"]:
        p0, m0 = old[c["ticker"]]
        assert c["marketCapB"] == round(m0 * delta["prices"][c["ticker"]] / p0)


def test_pesos_somam_100_e_total_confere(base):
    d, s = copy.deepcopy(base[0]), copy.deepcopy(base[1])
    nd, _ = daily.apply(d, s, _delta(d, 0.93))
    assert abs(sum(c["weight"] for c in nd["companies"]) - 100) < 0.05
    assert abs(nd["meta"]["totalMarketCapT"] * 1000 - sum(c["marketCapB"] for c in nd["companies"])) < 1


def test_snapshot_do_dia_e_cdslog(base):
    d, s = copy.deepcopy(base[0]), copy.deepcopy(base[1])
    nd, ns = daily.apply(d, s, _delta(d))
    assert ns["snapshots"][-1]["date"] == "2099-01-01"
    assert [x["date"] for x in ns["snapshots"]] == sorted({x["date"] for x in ns["snapshots"]})
    log = nd["meta"]["cdsLog"]
    assert len(log) <= C.CDS_LOG_KEEP and log[-1]["date"] == "2099-01-02" and "ª checagem" in log[-1]["text"]


def test_reexecucao_no_mesmo_dia_substitui_em_vez_de_duplicar(base):
    d, s = copy.deepcopy(base[0]), copy.deepcopy(base[1])
    nd, ns = daily.apply(d, s, _delta(d))
    nd2, ns2 = daily.apply(nd, ns, _delta(nd, 1.0))
    assert [x["date"] for x in ns2["snapshots"]].count("2099-01-01") == 1
    assert [x["date"] for x in nd2["meta"]["cdsLog"]].count("2099-01-02") == 1


def test_recusa_preco_faltando_e_data_futura(base):
    d, s = copy.deepcopy(base[0]), copy.deepcopy(base[1])
    delta = _delta(d)
    del delta["prices"]["TSLA"]
    with pytest.raises(SystemExit):
        daily.apply(copy.deepcopy(d), copy.deepcopy(s), delta)
    with pytest.raises(SystemExit):
        daily.apply(copy.deepcopy(d), copy.deepcopy(s), _delta(d, trade="2199-01-01"))


def test_cds_so_muda_quando_ha_cotacao_nova(base):
    d, s = copy.deepcopy(base[0]), copy.deepcopy(base[1])
    before = {c["ticker"]: c["cds"] for c in d["companies"]}
    delta = _delta(d)
    delta["cds"] = {"META": {"bps": 125, "asOf": "2026-11-09"}}
    nd, _ = daily.apply(d, s, delta)
    after = {c["ticker"]: c["cds"] for c in nd["companies"]}
    assert after["META"] == 125 and nd["meta"]["cdsAsOf"]["META"] == "2026-11-09"
    assert {k: v for k, v in after.items() if k != "META"} == {k: v for k, v in before.items() if k != "META"}
