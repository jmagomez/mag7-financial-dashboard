# Roadmap

Princípios: **(1)** nenhuma fase pode mudar um número exibido sem teste que explique a diferença;
**(2)** a rotina diária e o e-mail continuam funcionando em todas as fases; **(3)** nada em produção
(`main`, `data.json`, `.github/workflows`) muda sem revisão do dono.

## Fase 1 — Fundação (este PR)  ✅
- Higiene: `.gitignore`, `.editorconfig`, `pyproject.toml`, `requirements-dev.txt`, `CODEOWNERS`, template de PR, Dependabot.
- Testes Python (`tests/`): schemas JSON, invariantes (pesos, caps, snapshot × `data.json`), `daily.py`, `pd5`.
- Núcleo financeiro tipado (`web/src/lib/finance.ts`) com **paridade provada** contra o dashboard em produção
  (`tools/golden_from_dashboard.py` → `tests/golden/derived_golden.json`), 24 testes, `tsc --noEmit` e `vite build` ok.
- Contratos: `schemas/data.schema.json`, `schemas/snapshots.schema.json`.
- Documentação: auditoria, arquitetura, roadmap; workflows endurecidos em `docs/proposed/`.
- **Não muda**: `index.html`, dados, scripts de produção, workflows.

**Ações do dono após o merge**: (a) `cd web && npm install` e commitar `package-lock.json`; (b) copiar
`docs/proposed/workflows/ci.yml` (e opcionalmente `enviar-dashboard.yml`) para `.github/workflows/`; (c) escolher uma licença.

## Fase 2 — UI v2 em `web/` (paridade funcional)
Critério de aceite: 4 abas com os mesmos números do golden; zero `innerHTML` com dado externo e só URLs `https:` em `href`; axe sem violações sérias;
Lighthouse ≥ 95 (desempenho e acessibilidade); bundle < 250 KB gz.
1. `ChartFrame` (gráfico + resumo + tabela alternativa), tokens de tema claro/escuro, contraste AA, `print.css`.
2. Abas como rotas por hash, estado em módulo imutável, estados de carregando/erro/obsoleto.
3. Chip de idade por métrica; CDS defasado esmaecido e fora dos rankings; "Δ vs. DD/MM (N pregões)".
4. Testes e2e (Playwright) com Chart real e dados de fixture; teste de injeção (`<script>` em `dailyBrief`).
5. Ativar `pages.yml` e aposentar o `index.html` da raiz.

## Fase 3 — Modelo de dados com proveniência
1. `schemas/` v2: cada valor externo como `{value, asOf, source, tier}` (`primary|secondary|derived`).
2. `daily.py` valida `tier` (bloqueia `derived` por mais de 1 dia), grava `provenance` e preenche lacunas de snapshots.
3. Mover dados para `data/` e particionar `history/snapshots/AAAA-MM.json` (exige editar o gatilho do workflow de e-mail — ação do dono).
4. `sharesOutB` por classe (10-Q) substituindo ações implícitas; `fcfAfterSbcTTM`; WACC por empresa; EV ajustado.

## Fase 4 — Operação
Trava de e-mail gravada pela própria Action (E1/E2); fixar ações por SHA; histórico de qualidade dos dados
(% de preços `derived`, idade média de CDS) exibido no rodapé; e-mail com o mesmo componente de idade/qualidade do painel.
