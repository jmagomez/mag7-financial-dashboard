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

Aba Indicadores abre com o **briefing do dia** e o sinal do **próximo resultado**; o rodapé tem a **auditoria crítica**. Cabeçalho com **chips de frescor dos dados** (idade do snapshot de preços/market cap; fica amarelo acima de 14 dias) e, no rodapé, a seção **Checagem de consistência dos dados** (testes automáticos a cada carregamento). A aba ativa fica na URL (`#val`, `#hist`, `#cred`) e as abas respondem a setas do teclado.

Botão **Exportar dados (CSV)** gera um arquivo com todas as métricas, inclusive as derivadas (P/E TTM/core/forward, EV, EV/Vendas, caixa líquido, crescimento implícito, CapEx/OCF, PD implícita de CDS, FCF yield declarado × recalculado).

## Estrutura do repositório

| Arquivo | Descrição |
|---|---|
| `index.html` | Dashboard completo (Chart.js via CDN). Só apresentação + cálculos derivados; lê `data.json`. |
| `data.json` | **Fonte única de dados.** Todos os números reportados e as entradas dos cálculos. |
| `history/snapshots.json` | Série própria: um snapshot por dia útil (preços, market cap, CDS). Alimenta o gráfico de tendência de CDS e as variações do e-mail. |
| `history/email_log.json` | Último envio (trava de 1 e-mail/dia). Gravado pela rotina diária (commit `[skip-email]`) logo após o envio. |
| `src/validate.py` | Validador de `data.json` e snapshots (erros de estrutura; avisos de dado velho). |
| `src/send_email.py` | E-mail executivo diário (SMTP). Pula `[skip-email]` e aplica a trava diária. `--dry-run` gera `preview.html`. |
| `.github/workflows/enviar-dashboard.yml` | Action existente: executa `src/send_email.py` em push que altere `data.json`. |
| `.github/workflows/validate.yml` | **Opcional** (adição manual): validação + dry-run do e-mail em todo push/PR. Não instalado automaticamente. |

### `data.json` → bloco `derived` (fonte única auditável)

As **entradas** dos cálculos do front-end ficam em `data.json` sob `derived`, não embutidas no HTML — assim tudo é auditável em um só lugar e sai no CSV:

- `balanceQ2_2026` — caixa + títulos negociáveis e dívida financiada por empresa (para caixa líquido e EV);
- `cloudSegmentsQ2_2026` — receita e crescimento dos segmentos de nuvem/IA;
- `fcfTTM` — FCF TTM das 7 empresas, usado como ponto de partida do DCF reverso **e como base do FCF yield exibido**;
- `fwdPE` — P/E forward de consenso de ago/2026 (referência); `ebitdaImplB` e `fwdEPS` — denominadores implícitos usados para reescalar EV/EBITDA e P/E forward ao snapshot atual;
- `oneOffTTM` — ajustes de itens não recorrentes para o P/E core;
- `dcfAssumptions` — WACC, crescimento terminal e horizonte do DCF reverso.

O front-end **recalcula** P/E TTM, P/E core, FCF yield, caixa líquido, EV, EV/Vendas, EV/EBITDA, crescimento implícito, CapEx/OCF, PD implícita de CDS e P/E forward a cada carregamento; por isso o `data.json` guarda apenas dados reportados + entradas, sem múltiplos "congelados".

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

O histórico de checagens fica em `meta.cdsLog` (lista de `{date, text}`), exibido em "Histórico de verificações de CDS" na aba Crédito & CapEx. `meta.creditNotes` contém apenas a análise de crédito, sem o log.

### Vintages dos dados (datas diferentes por métrica)

- Preços, pesos e market cap: **snapshot em `meta.marketSnapshot`** (09/10/2026 até a primeira execução da rotina diária). Preço de fechamento (StockAnalysis, conferido com outras fontes) × quantidade de ações implícita no market cap anterior (aproximação); pesos = market cap ÷ total. O chip do cabeçalho mostra a idade; atualize para manter P/E, EV e FCF yield coerentes.
- Resultados trimestrais/anuais: releases oficiais e SEC (10-Q/8-K).
- EV/EBITDA e P/E forward: **reescalados** ao snapshot de preços — `derived.ebitdaImplB` (EBITDA implícito no múltiplo de jun–jul/2026) e `derived.fwdEPS` (LPA forward implícito no consenso de ago/2026) ficam constantes; o painel divide o EV/preço atual por eles. Revisões de EBITDA/consenso posteriores a ago/2026 NÃO estão incorporadas (ver `derived.multiplesNote`).
- CDS: cotações pontuais de imprensa, datadas por emissor em `meta.cdsAsOf` e nas notas de crédito.

## Automação

- **Rotina diária (dias úteis, ~07:30 BRT):** tarefa agendada pesquisa fechamento de preços, CDS 5a por empresa (com data da cotação), revisões de consenso/EBITDA, ratings, emissões de dívida e confirmação do calendário de resultados; revisa criticamente cada dado; grava um snapshot em `history/snapshots.json`; atualiza `data.json` (inclusive `meta.dailyBrief` e `meta.audit`) e `meta.generated`. Regra de ouro: **sem dado confiável, mantém o anterior ou deixa n/d — nunca inventa.**
- **E-mail — no máximo 1 por dia:** os commits intermediários da rotina levam `[skip-email]`; só o commit final de `data.json` dispara a Action `Enviar Dashboard Mag7`, que executa `src/send_email.py`. A rotina roda `src/validate.py` antes desse commit. Além da tag, há uma **trava diária** (`history/email_log.json`, fuso America/Sao_Paulo), gravada pela rotina logo após o commit final: se `lastSent` já for a data de hoje, o envio é pulado. Envio manual (`workflow_dispatch`) ignora a trava. O e-mail traz: alerta de CDS (>100 bps), briefing do dia, o que mudou desde o snapshot anterior (preço e CDS), indicadores-chave recalculados (P/E TTM e core, FCF yield, caixa líquido), CDS com data da cotação e PD implícita, próximos catalisadores e as ressalvas de auditoria de severidade alta. Secrets: `MAG7_SMTP_USER`, `MAG7_SMTP_APP_PASSWORD`, `MAG7_EMAIL_DEST`, `MAG7_EMAIL_BCC`.
- **Validação (CI, opcional):** se `validate.yml` for adicionado manualmente, a Action `Validar dados` roda em todo push/PR (`data.json`, `history/**`, `src/**`, `index.html`): estrutura, tamanhos de séries, reconciliações (soma de market caps, pesos, margens), ordem do `cdsLog`, snapshots, mais um *dry-run* do e-mail. Dado velho (preços > 3 dias, CDS > 30 dias, catalisador vencido) gera **aviso**, não falha. Localmente: `python src/validate.py`.
- **Temporada de resultados:** a rotina confirma as datas em `meta.catalysts` e, quando cada empresa divulga o trimestre, incorpora os números dos filings (novo trimestre — ver "Como atualizar").

## Auditoria crítica (`meta.audit`)

Limitações conhecidas, por severidade, exibidas no painel ("Auditoria crítica dos dados") e resumidas no e-mail: vintages de CDS misturadas (agora datadas em `meta.cdsAsOf`), market cap por ações implícitas, EBITDA implícito/defasado no EV/EBITDA, ajuste parcial de itens não recorrentes (P/E core de Alphabet), DCF reverso com WACC único, EV sem leases/participações e a janela de resultados do 3T.

## Como atualizar

1. Edite `data.json` (dados reportados e/ou o bloco `derived`).
2. Para um **novo trimestre**, acrescente o período em `revHistory`/`niHistory`, atualize `quarter`, `historyLabels`, `quarterLabel` e o `derived` (balanço, segmentos, FCF TTM, forward, ajustes).
3. Para **atualizar preços/market cap**, ajuste `price`, `weight`, `marketCapB`, `meta.totalMarketCapT` e `meta.marketSnapshot` (a checagem de consistência valida soma e pesos).
4. Commit sem `[skip-email]` para notificar (respeitando a trava de 1 e-mail/dia); com `[skip-email]` para manutenção silenciosa. Novos campos de metadados: `meta.cdsAsOf` (data da cotação de CDS por emissor), `meta.catalysts`, `meta.dailyBrief`, `meta.audit`.

## Aviso

Conteúdo informativo, **sem recomendação de investimento**. Todos os valores em US$.
