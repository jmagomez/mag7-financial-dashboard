# Arquitetura-alvo

Três camadas com contratos explícitos: **dados** (JSON versionado + schemas) → **pipeline** (Python, só biblioteca padrão) →
**web** (Vite + TypeScript, núcleo financeiro puro e testado). O e-mail e o dashboard consomem os mesmos dados e as mesmas regras.

## Árvore de diretórios ideal

Legenda: `✅` já existe após este PR · `🔜` fase seguinte · `⚠` exige ação do dono (workflow).

```text
mag7-financial-dashboard/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                      ⚠ lint + dados + pytest + typecheck/test/build (docs/proposed)
│   │   ├── enviar-dashboard.yml        ✅ (versão endurecida em docs/proposed)
│   │   └── pages.yml                   ⚠ build Vite + deploy no Pages
│   ├── CODEOWNERS                      ✅
│   ├── PULL_REQUEST_TEMPLATE.md        ✅
│   └── dependabot.yml                  ✅
├── data/                               🔜 ⚠ (Fase 3; hoje os JSON ficam na raiz por causa do gatilho do e-mail)
│   ├── daily.json                      (← data.json)
│   ├── fundamentals.json
│   ├── glossary.json
│   └── history/
│       ├── snapshots/AAAA-MM.json      (particionado por mês)
│       └── email_log.json
├── schemas/                            ✅
│   ├── data.schema.json
│   ├── snapshots.schema.json
│   └── fundamentals.schema.json        🔜
├── src/                                ✅ pipeline (← futuro pipeline/mag7/)
│   ├── common.py   daily.py   validate.py   send_email.py
├── web/                                ✅ scaffold + núcleo financeiro
│   ├── index.html   vite.config.ts   tsconfig.json   package.json   package-lock.json (⚠ gerar)
│   ├── public/                         🔜 favicon, og-image
│   ├── src/
│   │   ├── main.ts                     ✅
│   │   ├── types.ts                    ✅ contrato tipado dos dados
│   │   ├── lib/
│   │   │   ├── finance.ts              ✅ cálculos puros (PD, DCF reverso, EV, múltiplos)
│   │   │   ├── finance.test.ts         ✅ paridade com o dashboard em produção
│   │   │   ├── merge.ts                ✅
│   │   │   ├── format.ts               🔜 pt-BR (números, datas, US$ bi/tri)
│   │   │   ├── escape.ts               🔜 escape de HTML e URLs https
│   │   │   └── freshness.ts            🔜 idade por métrica (preço, CDS, fundamentos)
│   │   ├── data/loader.ts              🔜 fetch com cache/ETag, validação, estados de erro
│   │   ├── app/{router,state}.ts       🔜 abas por hash, estado imutável
│   │   ├── components/                 🔜 chart-frame (gráfico+tabela), kpi-card, data-table,
│   │   │                                  freshness-chip, signal-badge, glossary-tip
│   │   ├── features/{indicators,valuation,history,credit}/   🔜 view.ts · charts.ts · table.ts
│   │   └── styles/{tokens,base,dark,light,print}.css         🔜
│   └── tests/e2e/                      🔜 Playwright + axe
├── tests/                              ✅ Python
│   ├── golden/{finance_vectors.json, derived_golden.json}
│   ├── test_common.py   test_daily.py   test_data_contract.py   conftest.py
├── tools/golden_from_dashboard.py      ✅ regenera o golden a partir do dashboard real
├── docs/
│   ├── AUDITORIA.md   ARCHITECTURE.md   ROADMAP.md      ✅
│   ├── proposed/{README.md, workflows/*.yml}           ✅
│   ├── METHODOLOGY.md                  🔜 (extraída do README: P/E core, DCF reverso, PD implícita…)
│   └── adr/                            🔜 decisões numeradas
├── index.html                          ✅ dashboard em produção (aposentado ao fim da Fase 2)
├── CLAUDE.md   README.md   CONTRIBUTING.md   LICENSE (⚠ escolha do dono)
├── pyproject.toml   requirements-dev.txt   .editorconfig   .gitignore
```

## Contratos entre camadas

| Contrato | Quem escreve | Quem lê | Garantia |
|---|---|---|---|
| `data.json` | `daily.py` | web, e-mail, validate | `schemas/data.schema.json` + `validate.py` |
| `fundamentals.json` | tarefa mensal | web, e-mail, validate | `validate.py` (schema na Fase 3) |
| `history/snapshots.json` | `daily.py` | web (Δ, CDS), e-mail | `schemas/snapshots.schema.json` + ordem/unicidade |
| Indicadores derivados | `web/src/lib/finance.ts` | web (UI) | golden gerado do dashboard real (`tests/golden`) |
| PD do CDS | `common.py::pd5` e `finance.ts::pd5` | e-mail, web | âncoras em `tests/golden/finance_vectors.json` |

## Modelo de proveniência (Fase 3)

Hoje a origem de um número está em texto livre. Alvo: todo dado externo carrega sua origem e o painel reage a ela.

```json
{ "value": 139, "asOf": "2026-11-06", "source": "CNBC (S&P Global Market Intelligence)",
  "url": "https://…", "tier": "secondary", "tenor": "5Y" }
```

`tier`: `primary` (filing, release, feed oficial), `secondary` (imprensa/agregador citando a fonte), `derived` (calculado
de outro dado, ex.: preço = fechamento anterior × variação %). Regras: `derived` por mais de 1 dia seguido bloqueia o
envio; `secondary` com `asOf` > 30 dias é esmaecido e excluído de rankings; o e-mail mostra o mesmo selo do painel.

## Decisões (ADR resumidas)

1. **Vite + TypeScript** (escolha do dono). Custo: o deploy passa a exigir workflow de build (`pages.yml`), que só o dono pode criar. Mitigação: o `index.html` atual segue em produção até a Fase 2.
2. **Dados na raiz até a Fase 3.** Mover para `data/` altera o `paths:` do workflow de e-mail e o `CLAUDE.md`; fazer num único PR coordenado.
3. **Cálculo no cliente, mas com prova de paridade.** O dashboard em produção é o oráculo (`tools/golden_from_dashboard.py`); qualquer mudança de número tem de ser explicada no PR.
4. **Pipeline sem dependências de produção.** A Action só precisa do Python padrão; `pytest`/`jsonschema`/`ruff` ficam em `requirements-dev.txt`.
5. **Testes TS com `node:test`** (tipos removidos pelo Node ≥ 22.18), sem Vitest/Jest, para manter a árvore de dependências curta.
