"""Qualidade dos dados por snapshot (Fase 4): cálculo à mão, gravação em daily.apply(), formato do arquivo e schema."""
import copy
import json

import jsonschema

import common as C
import daily


def _comps(levels):
    return [{"ticker": t, "cds": v} for t, v in levels.items()]


def test_cds_quality_conta_a_mao():
    meta = {"cdsAsOf": {"MSFT": "2026-11-12", "NVDA": "2026-11-02", "GOOGL": "2026-09-30", "ORCL": "2026-11-12"}}
    q = C.cds_quality(meta, _comps({"MSFT": 53, "NVDA": 139, "GOOGL": 67, "AMZN": None, "META": 119}), "2026-11-12")
    # idades: MSFT 0, NVDA 10, GOOGL 43; META sem data e AMZN sem nível ficam de fora; ORCL (referência) não entra
    assert q == {"cdsCount": 3, "cdsAvgAgeDays": 17.7, "cdsMaxAgeDays": 43, "cdsStale": 1}


def test_cds_quality_sem_dado_e_none():
    assert C.cds_quality({"cdsAsOf": {}}, _comps({"MSFT": 53}), "2026-11-12") is None
    assert C.cds_quality({}, _comps({"MSFT": None}), "2026-11-12") is None


def _apply():
    d, snaps, fund = C.load("data.json"), C.load("history/snapshots.json"), C.load("fundamentals.json")
    delta = {"tradeDate": "2099-01-01", "today": "2099-01-01", "prices": {c["ticker"]: c["price"] for c in d["companies"]}, "snapshotNote": "x"}
    return daily.apply(copy.deepcopy(d), copy.deepcopy(snaps), delta, fund), snaps


def test_apply_grava_quality_no_snapshot_do_dia_e_nao_mexe_nos_antigos():
    (nd, ns), old = _apply()
    last = ns["snapshots"][-1]
    q = last["quality"]
    assert q["pricesTier"] == nd["meta"]["provenance"]["prices"]["tier"]
    assert q["cdsCount"] >= 1 and q["cdsMaxAgeDays"] >= q["cdsAvgAgeDays"] >= 0
    assert q == {"pricesTier": q["pricesTier"], **C.cds_quality(nd["meta"], nd["companies"], "2099-01-01")}
    assert ns["snapshots"][:-1] == old["snapshots"]  # snapshots antigos intactos (sem backfill inventado)
    assert "quality" not in json.dumps(nd)  # data.json não ganha o campo


def test_dump_roda_ida_e_volta_e_segue_o_schema():
    (_, ns), _ = _apply()
    text = daily.dump_snaps(ns)
    again = json.loads(text)
    assert again == ns
    schema = json.load(open(C.path("schemas/snapshots.schema.json"), encoding="utf-8"))
    jsonschema.validate(again, schema)
    assert text.rindex('"quality"') < text.rindex('"note"')


def test_schema_rejeita_quality_malformada():
    schema = json.load(open(C.path("schemas/snapshots.schema.json"), encoding="utf-8"))
    base = {"snapshots": [{"date": "2026-11-12", "quality": {"pricesTier": "secondary", "cdsCount": 5, "cdsAvgAgeDays": 3.2, "cdsMaxAgeDays": 9, "cdsStale": 0}}]}
    jsonschema.validate(base, schema)
    for bad in ({"pricesTier": "x"}, {"cdsCount": 0}, {"cdsAvgAgeDays": -1}, {"extra": 1}):
        b = copy.deepcopy(base)
        b["snapshots"][0]["quality"].update(bad)
        try:
            jsonschema.validate(b, schema)
        except jsonschema.ValidationError:
            continue
        raise AssertionError(f"aceitou {bad}")
