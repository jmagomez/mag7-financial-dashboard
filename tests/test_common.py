"""Núcleo compartilhado: PD implícita do CDS e constantes. Âncoras em tests/golden/finance_vectors.json
(as mesmas que os testes TypeScript leem, garantindo a paridade Python × TypeScript × index.html)."""
import json
import pathlib

import common as C

VEC = json.loads((pathlib.Path(__file__).parent / "golden" / "finance_vectors.json").read_text(encoding="utf-8"))


def test_pd5_ancoras():
    for v in VEC["pd5"]:
        # Python devolve em %, sem arredondar; o front arredonda a 1 casa.
        assert round(C.pd5(v["bps"]), 1) == v["pct"]


def test_pd5_none():
    assert C.pd5(None) is None


def test_constantes():
    assert C.CDS_ALERT == 100 and C.CDS_R == 0.40 and C.CDS_LOG_KEEP == 6
    assert C.TICKERS == ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA"]
