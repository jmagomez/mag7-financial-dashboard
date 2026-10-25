# CLAUDE.md — manual operacional (fonte única do processo)

Dashboard "Magnificent 7" (AAPL MSFT NVDA GOOGL AMZN META TSLA). Ao vivo: https://jmagomez.github.io/mag7-financial-dashboard/ · branch `main`.
Público: analistas CFA / setor de tecnologia. Postura: especialista em finanças, crítico e rigoroso. Saída em **português**. Conteúdo informativo, **sem recomendação de investimento**.

## Regra de ouro
**Nunca inventar número.** Sem fonte confiável e datada, mantenha o valor anterior ou use `n/d`. Fontes de segunda mão (ex.: Bloomberg citado por terceiros) devem ser declaradas como tal.

## Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `data.json` | Dados **diários** (~16 KB): por empresa só `price`, `weight`, `marketCapB`, `cds`; em `meta`: `generated`, `marketSnapshot`, `totalMarketCapT`, `cdsRef`, `cdsAsOf`, `cdsLog` (últimos 6), `cdsNote`, `priceNote`, `dailyBrief`, `audit`, `catalysts`; mais `priceSource`. JSON compacto + `\n`. Escrito por `src/daily.py`. É o arquivo que dispara a Action de e-mail. |
| `fundamentals.json` | Dados **trimestrais/estáticos** (~20 KB): resultados, históricos, ratings, `derived`, notas metodológicas e fontes. Só muda na incorporação de um trimestre (ou revisão de consenso). Nunca é tocado pela rotina diária. |
| `history/snapshots.json` | Um snapshot por pregão (preços, marketCapB, CDS, nota). |
| `history/email_log.json` | Trava de 1 e-mail/dia: `{"lastSent":"AAAA-MM-DD","note":"..."}`. |
| `glossary.json` | **Glossário único de siglas**: lido pelo dashboard (dicas + seção), pelo e-mail (rodapé) e por `validate.py`. |
| `src/common.py` | Constantes compartilhadas (TICKERS, NAMES, CDS_ALERT=100, R=0.40, CDS_LOG_KEEP=6), `pd5`, `glossary()` e `load_data()`/`merge()`, que juntam `data.json` + `fundamentals.json` no formato único usado por validador, e-mail e dashboard. |
| `src/daily.py` | Aplica o *delta* do dia a `data.json` + snapshot de forma determinística e roda `validate.py`. Só escreve `data.json` e `history/snapshots.json`. |
| `src/validate.py` | Bloqueia o envio em erro; avisa em dado velho. Mesmas regras no CI. |
| `src/send_email.py` | E-mail executivo (Action `enviar-dashboard.yml`, disparada por push em `data.json`). |
| `index.html` | Apresentação + cálculos derivados; lê `data.json`, `fundamentals.json`, `history/snapshots.json`, `glossary.json`. |

## Rotina diária (dias úteis) — procedimento

1. **Ler estado**: `CLAUDE.md` (este arquivo), `data.json`, últimas entradas de `history/snapshots.json`, `history/email_log.json`. Data de hoje no fuso America/Sao_Paulo.
2. **Pesquisar** (cada número com fonte e data): fechamento do último pregão das 7 ações; CDS 5a (só cotações novas e confiáveis, com a data da cotação); consenso/EBITDA, ratings, emissões de dívida; calendário de resultados (`meta.catalysts`); notícias relevantes ao crédito/IA.
3. **Montar `delta.json`** e rodar `python3 src/daily.py delta.json` (**sem `-I`**, senão o import de `common` falha). Chaves do delta:
   `tradeDate`, `today`, `prices` (7 tickers), `cds` `{ticker:{bps,asOf}}` (apenas novas), `snapshotNote`, `cdsLog` (numeração "Nª checagem" automática; substitui entrada do mesmo dia), `dailyBrief`, `audit`, `catalysts`, `cdsNote` (texto completo, opcional), `priceSource {label,url}`, `priceSourceShort`.
   O script recalcula: preço, `marketCapB = round(cap_ant × preço_novo / preço_ant)` (ações implícitas), pesos (2 casas), `totalMarketCapT`, `marketSnapshot`, `generated`, `cdsRef/cdsAsOf`, o snapshot do dia, os "~N" de `cdsNote`, datas/total em `priceNote` e `priceSource` — mantém só os 6 últimos itens do `cdsLog` — e roda `validate.py`.
4. **Briefing** (`dailyBrief`): sempre nomear a empresa que passou de 100 bps de CDS; **escrever siglas por extenso na primeira menção** (o e-mail não tem as dicas do painel; siglas fora de `glossary.json` geram aviso — acrescente-as ao glossário).
   **Textos curtos**: `cdsNote` ≤ ~1.200 caracteres (níveis, datas, fontes principais; o histórico fica no `cdsLog` e nos snapshots), itens de `audit` ≤ ~400 caracteres, `cdsLog` uma linha de 1–3 frases por dia. Reescreva `cdsNote` quando mudarem datas/fontes (o script só sincroniza os níveis e a data "verificado em").
5. **Validar**: 0 erros. Erro = não commitar `data.json` final; corrigir ou manter o valor anterior.
6. **Commits** (ver "E-mail"), via MCP GitHub `create_or_update_file` (conteúdo **integral** do arquivo, exige o SHA do blob atual). `git push` e `push_files` não funcionam; `.github/workflows` não pode ser editado. Clone somente-leitura (`git clone`) funciona para trabalhar localmente.
7. **Verificar** os arquivos remotos contra os locais.
8. **Notificar** (PushNotification com `<routine_summary>`) **somente** se: CDS > 100 bps em alguma Mag 7, variação de CDS ≥ 15%, variação de preço ≥ 5%, mudança de rating, divulgação de resultado, falha da rotina ou bloqueio de validação. Caso contrário, silêncio.

Não incorporar novo trimestre na rotina diária (é a tarefa mensal/manual, abaixo).

## Novo trimestre (tarefa mensal/manual) — só `fundamentals.json`
**Gatilho**: as 7 empresas divulgaram o trimestre-alvo (releases/SEC). Antes disso, só o status mensal; nada é alterado.

**Em `fundamentals.json`** (mantenha os **nomes das chaves** como estão — `balanceQ2_2026` e `cloudSegmentsQ2_2026` são lidos assim pelo painel e pelo validador; renomear quebra a rotina):
1. `revHistory`/`niHistory` de cada empresa: acrescente o novo trimestre e remova o mais antigo (janela fixa de 10); em `meta.historyLabels` faça o mesmo (formato `Qn'AA`, ex.: `Q3'26`). O último ponto deve igualar `quarter.revenueB`/`quarter.netIncomeB` (±0,5).
2. Substitua o objeto `quarter` (period, revenueB, revGrowth, operatingIncomeB, netIncomeB, netMargin, epsDiluted, grossMargin, note) e atualize `meta.quarterLabel` (`Qn AAAA`, trimestre-calendário). Apple, Microsoft e Nvidia têm ano fiscal deslocado: alinhe pelo calendário.
3. `derived`: balanço (caixa+títulos e dívida financiada), `cloudSegmentsQ2_2026`, `fcfTTM`, `fwdPE`/`ebitdaImplB`/`fwdEPS`, `oneOffTTM` — **só com dado confirmado**; o que não for confirmado fica com o valor anterior e vai para o relatório como revisão manual. Itens não recorrentes (ganho/perda com participações, encargo jurídico/tributário) entram em `oneOffTTM`.
4. Quando um **ano fiscal** fecha: `annual`, `fcfAnnual`/`fcfLabels` e `capex`/`capexLabels`.
5. `data.json` (não é desta tarefa, mas conferir): marcar `done` nos `catalysts` já divulgados e revisar `meta.audit` (remover item resolvido, ex.: "Calendário"/"Itens não recorrentes").

**Textos fixos no `index.html`** (narrativa de trimestre, ex.: segNotes, qoeNotes, valNotes, rótulos "2T 2026"/"Q2 2026", "jun–jul/2026"): não são gerados dos dados. `validate.py` **avisa** quando o HTML cita no máximo um trimestre anterior ao `quarterLabel`. A tarefa automática **não** reescreve o HTML: liste esses textos no relatório para revisão manual (o dashboard continua correto nos números, mas a narrativa fica defasada).

**Validar e publicar**: rode `python3 src/validate.py` num clone (sem `-I`) com 0 erros — o validador cobra `quarterLabel` × `historyLabels`, últimos pontos × `quarter` e tamanhos das séries. Commit de `fundamentals.json` com `[skip-email]`; depois **um** commit de `data.json` (`meta.generated` = hoje) **sem** a tag para disparar o e-mail, respeitando a trava de 1 por dia e a validação. Mudanças só em `fundamentals.json` não disparam a Action de e-mail (o gatilho é `data.json`).

## E-mail: exatamente um por dia
- Todo commit intermediário leva `[skip-email]` na mensagem. Só o **commit final de `data.json`** não leva a tag.
- Se `email_log.lastSent` já é hoje (America/Sao_Paulo), **todos** os commits levam `[skip-email]`.
- **Ordem obrigatória**: (1) snapshot, (2) demais arquivos, (3) `data.json` final (dispara a Action), (4) `email_log.json` com `lastSent` de hoje, com `[skip-email]`. `validate.py` dá **erro** se `data.json` avançar sem o snapshot correspondente, e se preços/market cap/CDS divergirem do snapshot do mesmo pregão.
- Rodapé de todo commit:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` e `Claude-Session: <url da sessão>`.

## Invariantes (o validador cobra)
- Pesos somam ~100; soma dos caps ≈ total (±2); peso × total ≈ cap.
- CDS: bps a 5 anos, data em `meta.cdsAsOf` (aviso se > 30 dias); salto > 2× ou < 0,5× vs. último snapshot é **erro**, > 25% é aviso; `cdsNote` contém "~<cds>" de cada CDS das Mag 7.
- Preço com salto > 25% vs. snapshot anterior é erro (provável digitação).
- `cdsLog` em ordem e sem data posterior a `generated`; snapshots ordenados e únicos por data.
- `quarterLabel` no formato `Qn AAAA` e igual ao último rótulo de `historyLabels`; `index.html` sem BOM literal.
- PD 5a implícita: 1 − exp(−5·s/(1−R)), R = 0,40 (neutra ao risco; compara, não prevê).

## Armadilhas conhecidas
- MCP escreve arquivo inteiro: nunca retipar conteúdo de saída truncada; use `daily.py` e copie o arquivo gerado.
- O conteúdo enviado pelo MCP interpreta `\uXXXX` como o caractere: para gravar o texto literal `﻿` num arquivo, escreva `\uFEFF`.
- `merge()` aceita também o formato antigo (tudo em `data.json`), mas `daily.py` recusa esse formato.
- O CI `validate.yml` roda em **todo** push/PR (sem filtro de caminho): `validate.py` + dry-run do e-mail. Só a Action de e-mail tem filtro (`data.json`).
- `get_file_contents` de arquivos grandes salva em disco como JSON `[{type,text}]`.
- Chart.js vem de CDN; em testes de navegador no sandbox é preciso simular (`page.route`).
- O workflow dispara por push em `data.json`; qualquer mudança de caminho/trigger exige edição manual de `.github/workflows` pelo dono.

## Prompts mínimos das tarefas agendadas
- Diária: "Siga o `CLAUDE.md` na raiz do repositório `jmagomez/mag7-financial-dashboard` (branch main). Use `src/daily.py` para a parte numérica."
- Mensal: "Siga a seção 'Novo trimestre' do `CLAUDE.md`; mexa só em `fundamentals.json`; sem as 7 divulgações, apenas o status mensal."
