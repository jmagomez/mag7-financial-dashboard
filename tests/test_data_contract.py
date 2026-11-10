"""Contrato dos arquivos de dados: JSON Schema + invariantes de negócio + validate.py sem erros."""
import copy
import json
import subprocess
import sys

import pytest
from jsonschema import Draft202012Validator

import common as C


@pytest.fixture(scope="module")
def data():
    return json.load(open(C.path("data.json"), encoding="utf-8"))


@pytest.fixture(scope="module")
def snaps():
    return json.load(open(C.path("history/snapshots.json"), encoding="utf-8"))


def _errors(schema_rel, doc):
    schema = json.load(open(C.path(schema_rel), encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return [f"{'/'.join(map(str, e.absolute_path))}: {e.message}" for e in Draft202012Validator(schema).iter_errors(doc)]


def test_data_json_segue_o_schema(data):
    assert _errors("schemas/data.schema.json", data) == []


def test_snapshots_seguem_o_schema(snaps):
    assert _errors("schemas/snapshots.schema.json", snaps) == []


def test_schema_rejeita_dados_ruins(data):
    bad = copy.deepcopy(data)
    bad["companies"][0]["price"] = -1
    bad["companies"][1]["cds"] = "53"
    del bad["meta"]["dailyBrief"]
    msgs = " | ".join(_errors("schemas/data.schema.json", bad))
    assert "price" in msgs and "cds" in msgs and "dailyBrief" in msgs


def test_pesos_e_market_caps_fecham(data):
    cs = data["companies"]
    assert abs(sum(c["weight"] for c in cs) - 100) < 0.1
    total_b = data["meta"]["totalMarketCapT"] * 1000
    assert abs(sum(c["marketCapB"] for c in cs) - total_b) <= 2
    for c in cs:
        assert abs(c["weight"] / 100 * total_b - c["marketCapB"]) <= 0.01 * total_b


def test_snapshots_ordenados_e_unicos(snaps):
    dates = [s["date"] for s in snaps["snapshots"]]
    assert dates == sorted(set(dates))


def test_ultimo_snapshot_bate_com_data_json(data, snaps):
    last = next(s for s in snaps["snapshots"] if s["date"] == data["meta"]["marketSnapshot"])
    for c in data["companies"]:
        assert last["prices"][c["ticker"]] == c["price"]
        assert last["marketCapB"][c["ticker"]] == c["marketCapB"]


def test_validate_py_sem_erros():
    r = subprocess.run([sys.executable, C.path("src/validate.py")], capture_output=True, text=True, cwd=C.ROOT)
    assert r.returncode == 0, r.stdout + r.stderr
