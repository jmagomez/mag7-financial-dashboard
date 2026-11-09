# Contribuindo

Processo da rotina diária: **só** no [`CLAUDE.md`](CLAUDE.md). Auditoria e plano: [`docs/AUDITORIA.md`](docs/AUDITORIA.md),
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Ambiente
```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt ruff
cd web && npm install      # Node >= 22.18
```

## Checagens (as mesmas do CI)
```bash
ruff check tests tools         # lint (src/ entra depois: ver "Pendência conhecida" em docs/ROADMAP.md)
python src/validate.py         # dados (sem -I: o import de `common` falha com -I)
python -m pytest               # schemas, invariantes, daily.py, paridade das âncoras
cd web && npm run typecheck && npm test && npm run build
```

## Regras
- **Nunca inventar número.** Sem fonte datada: manter o valor anterior ou `n/d`.
- Dados só via `src/daily.py`; não editar preços, market caps ou pesos à mão.
- Mudou um cálculo? Rode `python tools/golden_from_dashboard.py` (precisa do Chromium do Playwright), **explique cada diferença** no PR e atualize `tests/golden/`.
- Não alterar `.github/workflows` sem o dono; propostas ficam em `docs/proposed/`.
- Conteúdo informativo, sem recomendação de investimento; texto em português.
