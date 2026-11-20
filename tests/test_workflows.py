"""Guarda dos workflows: um YAML inválido deixa a Action inteira sem rodar (foi o que derrubou o CI em 13/11/2026)."""
import glob
import os

import pytest

yaml = pytest.importorskip("yaml")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARQUIVOS = sorted(glob.glob(os.path.join(ROOT, ".github", "workflows", "*.yml")))


def test_ha_workflows():
    assert ARQUIVOS


@pytest.mark.parametrize("arq", ARQUIVOS, ids=os.path.basename)
def test_workflow_e_yaml_valido_e_todo_passo_faz_algo(arq):
    with open(arq, encoding="utf-8") as f:
        doc = yaml.safe_load(f)
    assert isinstance(doc, dict) and doc.get("jobs"), "workflow sem jobs"
    for jid, job in doc["jobs"].items():
        for i, passo in enumerate(job.get("steps") or [], 1):
            assert "run" in passo or "uses" in passo, f"{os.path.basename(arq)}: job {jid}, passo {i} ({passo.get('name')!r}) sem run nem uses"
