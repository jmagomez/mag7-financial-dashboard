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

**Estado (Fases 2a a 2k):** gráficos em SVG próprio (sem Chart.js; ~15,5 KB gz de JS na 2f). Portados: capitalização e briefing diário (Indicadores), P/E, EV/EBITDA e FCF yield (Valuation), Histórico completo (receita, lucro, margem e FCF anual, com tabela) e Crédito & CapEx completo (CapEx por ano, intensidade, CapEx ÷ OCF, CDS, tabela de ratings, tendência do CDS em escala log a partir de `history/snapshots.json`, notas e histórico de verificações), mais rodapé com notas metodológicas e fontes. Fase 2d: sinais (crédito, qualidade do lucro, pressão de CapEx, caixa líquido, próximo resultado), checagem de consistência (8 testes) e auditoria crítica, com paridade conferida contra o painel de produção (mesmos 5 sinais, 6/8 testes e 4 achados altos de 11). A contagem de dias usa `meta.generated`, não o relógio do navegador. Fase 2e: seletor de período (ano fiscal/trimestre) e ordenação da tabela por hash (`#ind-quarter-revenueB-asc`, links reais, `aria-sort`), KPIs agregados, gráficos de receita, margem e crescimento do período e tabela comparativa com Δ vs. o pregão anterior (data explícita); paridade conferida nos dois períodos (mesmos KPIs e mesmas linhas). Sem dado, o total vira "n/d" (nunca soma parcial) e valores ausentes vão ao fim da ordenação. Snapshots são opcionais: se falharem, só a tendência mostra aviso. O briefing não passa por `innerHTML` e só gera link para fontes `https:`. Fase 2f: gráfico de dividend yield (sem dividendo = n/d) e tabela "Múltiplos e caixa" (P/E, P/E core, P/E fwd, EV/EBITDA, div. yield, FCF yield, FCF TTM, margem bruta, caixa líquido, EV/Vendas), com os múltiplos vindos de `finance.ts`; nesta fase a tabela é ordenada por valor de mercado (sem ordenação por coluna) e P/E core ausente aparece como —. Fase 2g: gráficos de P/E forward, qualidade do lucro (líquido ÷ operacional do trimestre, com as duas séries na tabela), Regra dos 40, caixa líquido (com caixa e dívida na tabela) e DCF reverso, mais notas da aba; os 35 valores conferem com o painel de produção. Diferenças: barras horizontais ordenadas (produção usa colunas agrupadas), valores negativos sem barra (o número aparece no texto e na tabela) e qualidade do lucro como razão em vez de duas barras. Fase 2h: gráfico de receita dos segmentos de nuvem/IA do trimestre (com crescimento a/a na tabela) e dispersão crescimento × EV/EBITDA em SVG próprio (escala log, área da bolha = valor de mercado, rótulo de texto em cada ponto, resumo e tabela). Na dispersão, rótulos de empresas com valores próximos podem se sobrepor (a tabela traz todos os valores). Fase 2i: botão "Exportar dados (CSV)" com as mesmas 39 colunas do painel atual (CSV byte a byte idêntico ao de produção nos dados de hoje), com BOM UTF-8 e proteção contra injeção de fórmula no Excel (texto que começa com `=`, `+`, `-` ou `@` recebe apóstrofo; números não são alterados). Fase 2j (acessibilidade): axe-core 4.10 (regras wcag2a, wcag2aa, wcag21aa e best-practice) rodado em todas as abas e rotas (`#ind`, `#ind-quarter`, `#val`, `#cred`, `#hist`, `#hist-fcf`) nos temas claro e escuro, com todas as tabelas alternativas abertas: **0 violações** depois da correção (antes: 4 achados, 1 sério). Correções: um único `<main>` que contém abas e painel (o painel é um `div role="tabpanel"`, não o `<main>`), abas como `role="tablist"` sem `<nav>`, e tabelas com rolagem horizontal alcançáveis por teclado. O axe ainda não roda no CI (exige dependência nova e `package-lock.json`); a conferência é manual até o e2e. Fase 2k: a tabela "Múltiplos e caixa" passa a ordenar por qualquer coluna, pela mesma regra dos Indicadores (cabeçalhos com link real, `aria-sort`, rota `#val-pe-asc`; clicar na coluna ativa inverte, coluna nova começa decrescente). Sem dado (inclusive dividendo zero, que a tabela já mostra como —) vai sempre ao fim, em qualquer direção, e o empate se resolve por ticker; nome ordena em pt-BR.
**Falta para a paridade:** notas editoriais longas da aba Valuation (armadilhas de Alphabet/Amazon), glossário nos textos, e2e (Playwright) e axe no CI e Lighthouse.

## Fase 3 — Modelo de dados com proveniência
1. `schemas/` v2: cada valor externo como `{value, asOf, source, tier}` (`primary|secondary|derived`).
2. `daily.py` valida `tier` (bloqueia `derived` por mais de 1 dia), grava `provenance` e preenche lacunas de snapshots.
3. Mover dados para `data/` e particionar `history/snapshots/AAAA-MM.json` (exige editar o gatilho do workflow de e-mail — ação do dono).
4. `sharesOutB` por classe (10-Q) substituindo ações implícitas; `fcfAfterSbcTTM`; WACC por empresa; EV ajustado.

## Fase 4 — Operação
Trava de e-mail gravada pela própria Action (E1/E2); fixar ações por SHA; histórico de qualidade dos dados
(% de preços `derived`, idade média de CDS) exibido no rodapé; e-mail com o mesmo componente de idade/qualidade do painel.
