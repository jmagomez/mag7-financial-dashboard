"""src/daily.py::apply — a parte numérica determinística (market cap = preço × ações reportadas, pesos, cdsLog)."""
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


def test_market_cap_e_preco_vezes_acoes_reportadas(base):
    d, s = copy.deepcopy(base[0]), copy.deepcopy(base[1])
    sh = C.shares_reported(C.load("fundamentals.json"))
    delta = _delta(d)
    nd, ns = daily.apply(d, s, delta)
    for c in nd["companies"]:
        assert c["marketCapB"] == round(delta["prices"][c["ticker"]] * sh[c["ticker"]]["total"] / 1000)
    assert ns["snapshots"][-1]["marketCapB"] == {c["ticker"]: c["marketCapB"] for c in nd["companies"]}


# Valores CONGELADOS de 12/11/2026 (últimos publicados com o método antigo) e as capas dos 10-Q/10-K da Fase 3c.
# Não leem data.json nem fundamentals.json de propósito: o teste documenta a troca e não quebra quando os dados do dia mudam.
PRECO_12_11 = {"AAPL": 354.88, "MSFT": 523.0, "NVDA": 166.19, "GOOGL": 298.7, "AMZN": 267.44, "META": 623.61, "TSLA": 397.45}
CAP_IMPLICITA_12_11 = {"AAPL": 5180, "MSFT": 3884, "NVDA": 4025, "GOOGL": 3653, "AMZN": 2886, "META": 1590, "TSLA": 1567}
ACOES_CAPA_MI = {"AAPL": 14532.182, "MSFT": 7426.194552, "NVDA": 24100, "GOOGL": 12294, "AMZN": 10813.138306, "META": 2556.241253, "TSLA": 3952.757946}


def test_troca_do_metodo_muda_ate_0_6_por_cento_por_empresa():
    """Explica a diferença da Fase 3d: com os MESMOS preços de 12/11, market cap das ações implícitas (publicado)
    × preço × ações reportadas. Nenhuma empresa muda mais de 0,6% e o total, menos de 0,5% (22.785 → 22.775 bi)."""
    new = {t: round(PRECO_12_11[t] * ACOES_CAPA_MI[t] / 1000) for t in C.TICKERS}
    assert sum(CAP_IMPLICITA_12_11.values()) == 22785 and sum(new.values()) == 22775
    for t in C.TICKERS:
        assert abs(new[t] / CAP_IMPLICITA_12_11[t] - 1) <= 0.006, (t, CAP_IMPLICITA_12_11[t], new[t])
    assert abs(sum(new.values()) / sum(CAP_IMPLICITA_12_11.values()) - 1) < 0.0005
    assert {t: new[t] - CAP_IMPLICITA_12_11[t] for t in C.TICKERS} == {"AAPL": -23, "MSFT": 0, "NVDA": -20, "GOOGL": 19, "AMZN": 6, "META": 4, "TSLA": 4}


def test_nota_de_precos_descreve_o_novo_metodo_e_e_idempotente(base):
    d, s = copy.deepcopy(base[0]), copy.deepcopy(base[1])
    nd, ns = daily.apply(d, s, _delta(d))
    note = nd["meta"]["priceNote"]
    assert "ações em circulação da capa do último 10-Q/10-K" in note and "implícita" not in note and "Difere até" not in note
    assert "preço de 01/01 ×" in note
    nd2, _ = daily.apply(nd, ns, _delta(nd, 1.0, trade="2099-01-03", today="2099-01-04"))
    n2 = nd2["meta"]["priceNote"]
    assert n2.count("Market cap = ") == 1 and "preço de 03/01 ×" in n2


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
