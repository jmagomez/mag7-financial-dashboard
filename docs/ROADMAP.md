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

**Ações do dono após o merge** (feitas): `package-lock.json` commitado, `ci.yml` ativado em `.github/workflows/` e licença MIT adicionada.
Falta, só quando a Fase 2 estiver completa: ativar `pages.yml` (e, opcionalmente, `enviar-dashboard.yml` endurecido).

**Pendência conhecida (lint em `src/`)**: `ruff check src` acusa 3 itens antigos, que este PR não corrige para não tocar
código de produção: `src/daily.py:71` (B023, falso positivo prático: a função é usada na hora dentro do loop) e a ordem dos
imports em `src/send_email.py:21` e `src/validate.py:9` (corrigíveis com `ruff check --fix`). O CI proposto faz lint só de
`tests` e `tools`; ao corrigir esses 3 pontos, estender para `src`.

## Fase 2 — UI v2 em `web/` (paridade funcional)
Critério de aceite: 4 abas com os mesmos números do golden; zero `innerHTML` com dado externo e só URLs `https:` em `href`; axe sem violações sérias;
Lighthouse ≥ 95 (desempenho e acessibilidade); bundle < 250 KB gz.
1. ✅ (2a) `ChartFrame` (gráfico + resumo + tabela alternativa), tokens de tema claro/escuro com contraste AA testado, estilos de impressão.
2. ✅ (2a) Abas como rotas por hash (setas do teclado), estados de carregando/erro. Pendente: estado "obsoleto" por falha de atualização.
3. 🟡 (2a) Chip de idade nos preços e no CDS; CDS defasado (> 30 d) esmaecido e fora do ranking. Pendente: chip nas demais métricas e "Δ vs. DD/MM (N pregões)" (precisa de `history/snapshots.json`).
4. 🟡 (2a, 2b) Teste de injeção (`<script>` em nomes, resumos e no briefing) e de `href` só `https:` em `node:test`, sem dependências novas. Pendente: e2e com Playwright.
5. Ativar `pages.yml` e aposentar o `index.html` da raiz. (Só depois da paridade das 4 abas.)

**Estado (Fases 2a a 2e):** gráficos em SVG próprio (sem Chart.js; ~7,5 KB gz de JS). Portados: capitalização e briefing diário (Indicadores), P/E, EV/EBITDA e FCF yield (Valuation), Histórico completo (receita, lucro, margem e FCF anual, com tabela) e Crédito & CapEx completo (CapEx por ano, intensidade, CapEx ÷ OCF, CDS, tabela de ratings, tendência do CDS em escala log a partir de `history/snapshots.json`, notas e histórico de verificações), mais rodapé com notas metodológicas e fontes. Fase 2d: sinais (crédito, qualidade do lucro, pressão de CapEx, caixa líquido, próximo resultado), checagem de consistência (8 testes) e auditoria crítica, com paridade conferida contra o painel de produção (mesmos 5 sinais, 6/8 testes e 4 achados altos de 11). A contagem de dias usa `meta.generated`, não o relógio do navegador. Fase 2e: seletor de período (ano fiscal/trimestre) e ordenação da tabela por hash (`#ind-quarter-revenueB-asc`, links reais, `aria-sort`), KPIs agregados, gráficos de receita, margem e crescimento do período e tabela comparativa com Δ vs. o pregão anterior (data explícita); paridade conferida nos dois períodos (mesmos KPIs e mesmas linhas). Sem dado, o total vira "n/d" (nunca soma parcial) e valores ausentes vão ao fim da ordenação. Snapshots são opcionais: se falharem, só a tendência mostra aviso. O briefing não passa por `innerHTML` e só gera link para fontes `https:`.
**Falta para a paridade:** gráficos de nuvem/IA e qualidade do lucro, tabela de valuation, dividend yield e dispersão crescimento × valuation, exportação CSV, glossário nos textos, e2e (Playwright) e axe/Lighthouse.

## Fase 3 — Modelo de dados com proveniência
1. `schemas/` v2: cada valor externo como `{value, asOf, source, tier}` (`primary|secondary|derived`).
2. `daily.py` valida `tier` (bloqueia `derived` por mais de 1 dia), grava `provenance` e preenche lacunas de snapshots.
3. Mover dados para `data/` e particionar `history/snapshots/AAAA-MM.json` (exige editar o gatilho do workflow de e-mail — ação do dono).
4. `sharesOutB` por classe (10-Q) substituindo ações implícitas; `fcfAfterSbcTTM`; WACC por empresa; EV ajustado.

## Fase 4 — Operação
Trava de e-mail gravada pela própria Action (E1/E2); fixar ações por SHA; histórico de qualidade dos dados
(% de preços `derived`, idade média de CDS) exibido no rodapé; e-mail com o mesmo componente de idade/qualidade do painel.
