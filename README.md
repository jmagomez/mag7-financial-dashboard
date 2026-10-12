# Magnificent 7 — Dashboard de Indicadores Financeiros

Dashboard web comparando os principais indicadores financeiros das **Magnificent 7**:
Apple (AAPL), Microsoft (MSFT), Alphabet (GOOGL), Amazon (AMZN), Meta (META), Nvidia (NVDA) e Tesla (TSLA).

**Dashboard ao vivo:** https://jmagomez.github.io/mag7-financial-dashboard/

Painel voltado a análise financeira de empresas de tecnologia em nível profissional. Princípio central: **não inventar números** — se um dado não existe ou não é público, o painel diz "n/d"/"n/s" em vez de estimar.

## Abas

- **Indicadores** — receita, margem líquida, crescimento a/a e market cap (alternando FY2025 × 2T 2026); **sinais automáticos** (alerta de CDS > 100 bps, qualidade do lucro, maior pressão de CapEx, balanço com caixa líquido negativo); motor de nuvem/IA (receita por segmento) e tabela comparativa ordenável.
- **Valuation** — P/E TTM vs P/E core, EV/EBITDA, FCF yield (recalculado a partir do FCF TTM), dividend yield, **qualidade do lucro (operacional vs GAAP)**, crescimento × valuation (bolha), Regra dos 40, caixa líquido, DCF reverso ("o que está no preço") e P/E forward, mais tabela de múltiplos.
- **Histórico** — receita, lucro líquido, margem (10 trimestres, Q1'24–Q2'26) e FCF anual.
- **Crédito & CapEx** — CapEx anual, intensidade de CapEx, **pressão de CapEx sobre o caixa operacional (CapEx ÷ OCF)**, ratings, níveis recentes de CDS com linha de alerta de 100 bps, **PD de 5 anos implícita no CDS** (com Oracle e CoreWeave como referência), leitura crítica e histórico de verificações de CDS.

Cabeçalho com **chips de frescor dos dados** (idade do snapshot de preços/market cap; fica amarelo acima de 14 dias) e, no rodapé, a seção **Checagem de consistência dos dados** (testes automáticos a cada carregamento). A aba ativa fica na URL (`#val`, `#hist`, `#cred`) e as abas respondem a setas do teclado.

Botão **Exportar dados (CSV)** gera um arquivo com todas as métricas, inclusive as derivadas (P/E TTM/core/forward, EV, EV/Vendas, caixa líquido, crescimento implícito, CapEx/OCF, PD implícita de CDS, FCF yield declarado × recalculado).

## Estrutura do repositório

| Arquivo | Descrição |
|---|---|
| `index.html` | Dashboard completo (Chart.js via CDN). Só apresentação + cálculos derivados; lê `data.json`. |
| `data.json` | **Fonte única de dados.** Todos os números reportados e as entradas dos cálculos. |
| `src/send_email.py` | Envia o e-mail (SMTP) com resumo de CDS quando `data.json` muda. Pula o envio em commits `[skip-email]`. |
| `.github/workflows/enviar-dashboard.yml` | GitHub Action: dispara `send_email.py` em push que altere `data.json`. |

### `data.json` → bloco `derived` (fonte única auditável)

As **entradas** dos cálculos do front-end ficam em `data.json` sob `derived`, não embutidas no HTML — assim tudo é auditável em um só lugar e sai no CSV:

- `balanceQ2_2026` — caixa + títulos negociáveis e dívida financiada por empresa (para caixa líquido e EV);
- `cloudSegmentsQ2_2026` — receita e crescimento dos segmentos de nuvem/IA;
- `fcfTTM` — FCF TTM das 7 empresas, usado como ponto de partida do DCF reverso **e como base do FCF yield exibido**;
- `fwdPE` — P/E forward de consenso;
- `oneOffTTM` — ajustes de itens não recorrentes para o P/E core;
- `dcfAssumptions` — WACC, crescimento terminal e horizonte do DCF reverso.

O front-end **recalcula** P/E TTM, P/E core, FCF yield, caixa líquido, EV, EV/Vendas, crescimento implícito, CapEx/OCF, PD implícita de CDS e P/E forward a cada carregamento; por isso o `data.json` guarda apenas dados reportados + entradas, sem múltiplos "congelados".

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

A cada carregamento o painel verifica: soma dos market caps = total do grupo; peso × total = market cap; margem líquida = lucro ÷ receita (FY e trimestre); FCF yield declarado = FCF TTM ÷ market cap; existência de FCF TTM auditado por empresa; e frescor do snapshot de preços (≤ 14 dias). O resultado fica no rodapé ("N/6 testes ok").

### Log de verificações de CDS

O histórico de checagens fica em `meta.cdsLog` (lista de `{date, text}`), exibido em "Histórico de verificações de CDS" na aba Crédito & CapEx. `meta.creditNotes` contém apenas a análise de crédito, sem o log.

### Vintages dos dados (datas diferentes por métrica)

- Preços, pesos e market cap: **snapshot em `meta.marketSnapshot`** (09/10/2026). Preço de fechamento (StockAnalysis, conferido com outras fontes) × quantidade de ações implícita no market cap anterior (aproximação); pesos = market cap ÷ total. O chip do cabeçalho mostra a idade; atualize para manter P/E, EV e FCF yield coerentes.
- Resultados trimestrais/anuais: releases oficiais e SEC (10-Q/8-K).
- EV/EBITDA: aproximado de **jun–jul/2026** e P/E forward de **ago/2026** (não recalculados com o snapshot novo).
- CDS: cotações pontuais de imprensa, datadas nas notas de crédito.

## Automação

- **E-mail (SMTP):** ao dar push em `data.json`, a Action executa `src/send_email.py`, que envia um resumo de crédito/CDS (com alerta se algum CDS das 7 passar de 100 bps). Commits de manutenção trazem `[skip-email]` na mensagem e **não** disparam e-mail. Secrets: `MAG7_SMTP_USER`, `MAG7_SMTP_APP_PASSWORD`, `MAG7_EMAIL_DEST`, `MAG7_EMAIL_BCC`.
- **Verificação de CDS (seg/qui):** tarefa agendada revisa os níveis de CDS e atualiza as notas quando há cotação nova datada.
- **Verificação de trimestre (mensal):** tarefa agendada checa quais das 7 já divulgaram o próximo trimestre-calendário e envia um status curto (o que saiu / o que falta). Quando as 7 estiverem disponíveis, os números reais são coletados dos filings e incorporados ao `data.json` (novo trimestre).

## Como atualizar

1. Edite `data.json` (dados reportados e/ou o bloco `derived`).
2. Para um **novo trimestre**, acrescente o período em `revHistory`/`niHistory`, atualize `quarter`, `historyLabels`, `quarterLabel` e o `derived` (balanço, segmentos, FCF TTM, forward, ajustes).
3. Para **atualizar preços/market cap**, ajuste `price`, `weight`, `marketCapB`, `meta.totalMarketCapT` e `meta.marketSnapshot` (a checagem de consistência valida soma e pesos).
4. Commit sem `[skip-email]` para notificar; com `[skip-email]` para manutenção silenciosa.

## Aviso

Conteúdo informativo, **sem recomendação de investimento**. Todos os valores em US$.
