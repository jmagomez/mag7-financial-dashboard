# Magnificent 7 — Dashboard de Indicadores Financeiros

Dashboard web comparando os principais indicadores financeiros das **Magnificent 7**:
Apple (AAPL), Microsoft (MSFT), Alphabet (GOOGL), Amazon (AMZN), Meta (META), Nvidia (NVDA) e Tesla (TSLA).

**Dashboard ao vivo:** https://jmagomez.github.io/mag7-financial-dashboard/

Painel voltado a análise financeira de empresas de tecnologia em nível profissional. Princípio central: **não inventar números** — se um dado não existe ou não é público, o painel diz "n/d"/"n/s" em vez de estimar.

## Abas

- **Indicadores** — receita, margem líquida, crescimento a/a e market cap (alternando FY2025 × 2T 2026); **sinais automáticos** (alerta de CDS > 100 bps, qualidade do lucro, maior pressão de CapEx, balanço com caixa líquido negativo); motor de nuvem/IA (receita por segmento) e tabela comparativa ordenável.
- **Valuation** — P/E TTM vs P/E core, EV/EBITDA, FCF yield (recalculado a partir do FCF TTM), dividend yield, **qualidade do lucro (operacional vs GAAP)**, crescimento × valuation (bolha), Regra dos 40, caixa líquido, DCF reverso ("o que está no preço") e P/E forward, mais tabela de múltiplos.
- **Histórico** — receita, lucro líquido, margem (10 trimestres, Q1'24–Q2'26) e FCF anual.
- **Crédito & CapEx** — tendência de CDS (snapshots diários), data da cotação por emissor, CapEx anual, intensidade de CapEx, **pressão de CapEx sobre o caixa operacional (CapEx ÷ OCF)**, ratings, níveis recentes de CDS com linha de alerta de 100 bps, **PD de 5 anos implícita no CDS** (com Oracle e CoreWeave como referência), leitura crítica e histórico de verificações de CDS.

Aba Indicadores abre com o **briefing do dia** e o sinal do **próximo resultado**; a tabela comparativa traz a coluna **Δ dia** (variação do preço vs. o pregão anterior registrado em `history/snapshots.json`); o rodapé tem o **glossário de siglas** e a **auditoria crítica**. Cabeçalho com **chips de frescor dos dados** (idade do snapshot de preços/market cap; fica amarelo acima de 14 dias) e, no rodapé, a seção **Checagem de consistência dos dados** (testes automáticos a cada carregamento). A aba ativa fica na URL (`#val`, `#hist`, `#cred`) e as abas respondem a setas do teclado.

### Glossário de siglas (SOX, CDS, bps…)

Siglas como **SOX** não são indicadores do painel: aparecem apenas no texto dos briefings diários. **SOX** = PHLX Semiconductor Sector Index (Índice de Semicondutores da Filadélfia), 30 empresas de chips listadas nos EUA (inclui a Nvidia), usado como termômetro do setor de semicondutores/IA.

O front-end mostra uma **dica (sublinhado pontilhado)** na primeira ocorrência de cada sigla no briefing e uma seção **Glossário de siglas** no rodapé. As definições ficam em **`glossary.json`** (fonte única: dashboard, rodapé do e-mail e `validate.py`, que avisa sobre sigla em maiúsculas no briefing que não esteja lá). Para acrescentar termos, edite apenas esse arquivo. Boa prática: **escrever a sigla por extenso na primeira menção**.

Botão **Exportar dados (CSV)** gera um arquivo com todas as métricas, inclusive as derivadas (P/E TTM/core/forward, EV, EV/Vendas, caixa líquido, crescimento implícito, CapEx/OCF, PD implícita de CDS, FCF yield declarado × recalculado).

## Estrutura do repositório

| Arquivo | Descrição |
|---|---|
| `index.html` | Dashboard completo (Chart.js via CDN). Só apresentação + cálculos derivados; lê `data.json`, `fundamentals.json`, `history/snapshots.json` e `glossary.json`. |
| `data.json` | **Dados diários** (preço, market cap, peso, CDS, briefing, auditoria, nota de CDS). Também é o gatilho da Action de e-mail. |
| `fundamentals.json` | **Dados trimestrais/estáticos**: resultados, históricos, ratings, bloco `derived`, notas metodológicas e fontes. Só muda ao incorporar um trimestre. |
| `glossary.json` | Glossário único de siglas (dashboard, e-mail, validação). |
| `CLAUDE.md` | **Manual operacional completo** da rotina diária (procedimento, e-mail, invariantes, armadilhas). |
| `history/snapshots.json` | Série própria: um snapshot por dia útil (preços, market cap, CDS). Alimenta o gráfico de tendência de CDS, a coluna Δ dia e as variações do e-mail. |
| `history/email_log.json` | Último envio (trava de 1 e-mail/dia). Gravado pela rotina diária (commit `[skip-email]`) logo após o envio. |
| `src/common.py` | Constantes e utilitários compartilhados (tickers, limiar de CDS, PD implícita, glossário) e `load_data()`, que junta `data.json` + `fundamentals.json`. |
| `src/daily.py` | Atualização diária determinística de `data.json` + snapshot a partir de um `delta.json`; roda a validação. |
| `src/validate.py` | Validador de `data.json` + `fundamentals.json` e snapshots (erros de estrutura e de consistência com o snapshot e entre rótulos trimestrais; avisos de dado velho, trimestre defasado no HTML e sigla fora do glossário). |
| `src/send_email.py` | E-mail executivo diário (SMTP). Pula `[skip-email]` e aplica a trava diária. `--dry-run` gera `preview.html`. |
| `.github/workflows/enviar-dashboard.yml` | Action existente: executa `src/send_email.py` em push que altere `data.json`. |
| `.github/workflows/validate.yml` | CI: validação + dry-run do e-mail em todo push/PR. |

### `fundamentals.json` → bloco `derived` (fonte única auditável)

As **entradas** dos cálculos do front-end ficam em `fundamentals.json` sob `derived`, não embutidas no HTML — assim tudo é auditável em um só lugar e sai no CSV:

- `balanceQ2_2026` — caixa + títulos negociáveis e dívida financiada por empresa (para caixa líquido e EV);
- `cloudSegmentsQ2_2026` — receita e crescimento dos segmentos de nuvem/IA;
- `fcfTTM` — FCF TTM das 7 empresas, usado como ponto de partida do DCF reverso **e como base do FCF yield exibido**;
- `fwdPE` — P/E forward de consenso de ago/2026 (referência); `ebitdaImplB` e `fwdEPS` — denominadores implícitos usados para reescalar EV/EBITDA e P/E forward ao snapshot atual;
- `oneOffTTM` — ajustes de itens não recorrentes para o P/E core;
- `dcfAssumptions` — WACC, crescimento terminal e horizonte do DCF reverso.

O front-end **recalcula** P/E TTM, P/E core, FCF yield, caixa líquido, EV, EV/Vendas, EV/EBITDA, crescimento implícito, CapEx/OCF, PD implícita de CDS e P/E forward a cada carregamento; por isso os arquivos de dados guardam apenas dados reportados + entradas, sem múltiplos "congelados".

## Metodologia

- **Anos fiscais** — as 7 empresas têm calendários diferentes. `FY2025` = o ano fiscal rotulado 2025 por cada uma. `Q2 2026` = trimestre-calendário Abr–Jun 2026, alinhado entre todas (Apple = Q3 FY26, Microsoft = Q4 FY26, Nvidia = Q2 FY27; demais = Q2 2026).
- **P/E TTM (GAAP)** = market cap do snapshot de preços (`meta.marketSnapshot`) ÷ lucro líquido GAAP dos últimos 4 trimestres.
- **P/E core** = P/E TTM excluindo itens não recorrentes (`oneOffTTM`), sobretudo ganhos NÃO realizados com participações (mark-to-market). Aproximado, líquido de impostos estimado.
- **FCF yield** = `derived.fcfTTM` ÷ market cap. Todas as 7 empresas têm `fcfTTM` (Amazon −US$ 7,6 bi; Tesla US$ 5,8 bi); se alguma ficar sem, o painel mostra o valor declarado e sinaliza como não auditado.
- **Qualidade do lucro** — compara lucro **operacional** (o negócio) com lucro **líquido GAAP** do trimestre. O sinal automático acende quando o líquido supera 1,5× o operacional (ex.: Alphabet, Amazon e Tesla no 2T'26).
- **Caixa líquido** = caixa + títulos negociáveis − dívida financiada (exclui arrendamentos e participações não negociáveis). **EV** = market cap − caixa líquido.
- **DCF reverso** — resolve o CAGR de FCF nos próximos 10 anos que iguala o valor presente ao EV atual (WACC 9%, crescimento terminal 3%). Fica "n/s" quando o FCF TTM é ≤ 0 ou quando o EV exigiria mais de 30% a.a. por 10 anos (hoje Amazon e Tesla).
- **Regra dos 40** = crescimento de receita (a/a) + margem de FCF (FCF ÷ receita), FY2025.
- **CapEx ÷ OCF** = CapEx ÷ (FCF + CapEx), FY2025 (OCF aproximado; arrendamentos financeiros fora do CapEx). Acima de ~80% o investimento absorve quase todo o caixa operacional.
- **PD 5a implícita (CDS)** ≈ 1 − exp(−5·s/(1−R)), com recuperação R = 40% e taxa de risco constante. É neutra ao risco (inclui prêmio de risco/liquidez), portanto tende a superestimar a probabilidade real de default — serve para comparar empresas, não como previsão.
- **P/E forward** — consenso de agregadores (aprox. ago/2026); a definição varia entre fontes (NTM vs FY2027) — usar como ordem de grandeza.
- **CDS** — cotações pontuais de imprensa (dado proprietário, sem série histórica pública consistente). Apple e Tesla ficam "n/d".

### Checagem de consistência (automática)

A cada carregamento o painel verifica: soma dos market caps = total do grupo; peso × total = market cap; margem líquida = lucro ÷ receita (FY e trimestre); FCF yield declarado = FCF TTM ÷ market cap; existência de FCF TTM auditado por empresa; frescor do snapshot de preços (≤ 14 dias); cotações de CDS datadas e com ≤ 30 dias; e acúmulo de snapshots diários. O resultado fica no rodapé ("N/M testes ok").

### Log de verificações de CDS

O histórico recente de checagens fica em `meta.cdsLog` de `data.json` (lista de `{date, text}`, só os 6 últimos; os antigos ficam no histórico do git), exibido em "Histórico de verificações de CDS" na aba Crédito & CapEx. A nota de CDS vigente é `meta.cdsNote`; a análise de crédito estática fica em `meta.creditNotes` de `fundamentals.json`.

### Vintages dos dados (datas diferentes por métrica)

- Preços, pesos e market cap: **snapshot em `meta.marketSnapshot`** (atualizado a cada pregão pela rotina diária). Preço de fechamento (StockAnalysis, conferido com outras fontes) × quantidade de ações implícita no market cap anterior (aproximação); pesos = market cap ÷ total. O chip do cabeçalho mostra a idade; atualize para manter P/E, EV e FCF yield coerentes.
- Resultados trimestrais/anuais: releases oficiais e SEC (10-Q/8-K).
- EV/EBITDA e P/E forward: **reescalados** ao snapshot de preços — `derived.ebitdaImplB` (EBITDA implícito no múltiplo de jun–jul/2026) e `derived.fwdEPS` (LPA forward implícito no consenso de ago/2026) ficam constantes; o painel divide o EV/preço atual por eles. Revisões de EBITDA/consenso posteriores a ago/2026 NÃO estão incorporadas (ver `derived.multiplesNote`).
- CDS: cotações pontuais de imprensa, datadas por emissor em `meta.cdsAsOf` e nas notas de crédito.

## Automação

Todo o procedimento da rotina diária (pesquisa, `daily.py`, ordem dos commits, regra de 1 e-mail/dia com `[skip-email]`, notificações e invariantes) está em **[`CLAUDE.md`](CLAUDE.md)** — única referência; não duplicar aqui. Resumo: a rotina grava o snapshot, atualiza `data.json` (inclusive `meta.dailyBrief` e `meta.audit`) e o commit final de `data.json` dispara a Action `Enviar Dashboard Mag7` (`src/send_email.py`, trava diária em `history/email_log.json`). Secrets: `MAG7_SMTP_USER`, `MAG7_SMTP_APP_PASSWORD`, `MAG7_EMAIL_DEST`, `MAG7_EMAIL_BCC`. Envio manual (`workflow_dispatch`) ignora a trava. A Action `Validar dados` roda em todo push/PR; localmente: `python3 src/validate.py`.

## Auditoria crítica (`meta.audit`)

Limitações conhecidas, por severidade, exibidas no painel ("Auditoria crítica dos dados") e resumidas no e-mail: vintages de CDS misturadas (agora datadas em `meta.cdsAsOf`), market cap por ações implícitas, EBITDA implícito/defasado no EV/EBITDA, ajuste parcial de itens não recorrentes (P/E core de Alphabet), DCF reverso com WACC único, EV sem leases/participações e a janela de resultados do 3T.

## Como atualizar

- **Diário**: `python3 src/daily.py delta.json` (ver `CLAUDE.md`) — nunca editar preços/market cap/pesos à mão.
- **Novo trimestre** (manual, só `fundamentals.json`): acrescente o período em `revHistory`/`niHistory` (mantendo a janela de 10), atualize `quarter`, `historyLabels`, `quarterLabel` e o `derived`; os textos de narrativa fixos no `index.html` são revisados à mão (o validador avisa quando ficam defasados). Detalhes no `CLAUDE.md`.
- Campos diários de `meta`: `cdsAsOf`, `catalysts`, `dailyBrief`, `audit`, `cdsNote`, `priceNote`. Siglas novas vão em `glossary.json`.

## Aviso

Conteúdo informativo, **sem recomendação de investimento**. Todos os valores em US$.
