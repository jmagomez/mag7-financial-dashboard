# CLAUDE.md — manual operacional (fonte única do processo)

Dashboard "Magnificent 7" (AAPL MSFT NVDA GOOGL AMZN META TSLA). Ao vivo: https://jmagomez.github.io/mag7-financial-dashboard/ · branch `main`.
Público: analistas CFA / setor de tecnologia. Postura: especialista em finanças, crítico e rigoroso. Saída em **português**. Conteúdo informativo, **sem recomendação de investimento**.

## Regra de ouro
**Nunca inventar número.** Sem fonte confiável e datada, mantenha o valor anterior ou use `n/d`. Fontes de segunda mão (ex.: Bloomberg citado por terceiros) devem ser declaradas como tal.

## Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `data.json` | Fonte única dos dados (JSON compacto + `\n` final). Escrito por `src/daily.py`. |
| `history/snapshots.json` | Um snapshot por pregão (preços, marketCapB, CDS, nota). |
| `history/email_log.json` | Trava de 1 e-mail/dia: `{"lastSent":"AAAA-MM-DD","note":"..."}`. |
| `glossary.json` | **Glossário único de siglas**: lido pelo dashboard (dicas + seção), pelo e-mail (rodapé) e por `validate.py`. |
| `src/common.py` | Constantes compartilhadas (TICKERS, NAMES, CDS_ALERT=100, R=0.40), `pd5`, `glossary()`. |
| `src/daily.py` | Aplica o *delta* do dia a `data.json` + snapshot de forma determinística e roda `validate.py`. |
| `src/validate.py` | Bloqueia o envio em erro; avisa em dado velho. Mesmas regras no CI. |
| `src/send_email.py` | E-mail executivo (Action `enviar-dashboard.yml`, disparada por push em `data.json`). |
| `index.html` | Apresentação + cálculos derivados; lê `data.json`, `history/snapshots.json`, `glossary.json`. |

## Rotina diária (dias úteis) — procedimento

1. **Ler estado**: `data.json`, últimas entradas de `history/snapshots.json`, `history/email_log.json`. Data de hoje no fuso America/Sao_Paulo.
2. **Pesquisar** (cada número com fonte e data): fechamento do último pregão das 7 ações; CDS 5a (só cotações novas e confiáveis, com a data da cotação); consenso/EBITDA, ratings, emissões de dívida; calendário de resultados (`meta.catalysts`); notícias relevantes ao crédito/IA.
3. **Montar `delta.json`** e rodar `python3 src/daily.py delta.json` (**sem `-I`**, senão o import de `common` falha). Chaves do delta:
   `tradeDate`, `today`, `prices` (7 tickers), `cds` `{ticker:{bps,asOf}}` (apenas novas), `snapshotNote`, `cdsLog` (numeração "Nª checagem" automática; substitui entrada do mesmo dia), `dailyBrief`, `audit`, `catalysts`, `creditNote3` (opcional), `priceSource {label,url}`, `priceSourceShort`.
   O script recalcula: preço, `marketCapB = round(cap_ant × preço_novo / preço_ant)` (ações implícitas), pesos (2 casas), `totalMarketCapT`, `marketSnapshot`, `generated`, `cdsRef/cdsAsOf`, o snapshot do dia, os "~N bps" de `creditNotes[3]`, datas/total em `notes[1]` e na fonte de preços — e roda `validate.py`.
4. **Briefing** (`dailyBrief`): sempre nomear a empresa que passou de 100 bps de CDS; **escrever siglas por extenso na primeira menção** (o e-mail não tem as dicas do painel; siglas fora de `glossary.json` geram aviso — acrescente-as ao glossário).
5. **Validar**: 0 erros. Erro = não commitar `data.json` final; corrigir ou manter o valor anterior.
6. **Commits** (ver "E-mail"), via MCP GitHub `create_or_update_file` (conteúdo **integral** do arquivo, exige o SHA do blob atual). `git push` e `push_files` não funcionam; `.github/workflows` não pode ser editado. Clone somente-leitura (`git clone`) funciona para trabalhar localmente.
7. **Verificar** os arquivos remotos contra os locais.
8. **Notificar** (PushNotification com `<routine_summary>`) **somente** se: CDS > 100 bps em alguma Mag 7, variação de CDS ≥ 15%, variação de preço ≥ 5%, mudança de rating, divulgação de resultado, falha da rotina ou bloqueio de validação. Caso contrário, silêncio.

Não incorporar novo trimestre na rotina diária (é tarefa manual/mensal: `revHistory`, `niHistory`, `quarter`, `historyLabels`, `derived`).

## E-mail: exatamente um por dia
- Todo commit intermediário leva `[skip-email]` na mensagem. Só o **commit final de `data.json`** não leva a tag.
- Se `email_log.lastSent` já é hoje (America/Sao_Paulo), **todos** os commits levam `[skip-email]`.
- **Ordem obrigatória**: (1) snapshot, (2) demais arquivos, (3) `data.json` final (dispara a Action), (4) `email_log.json` com `lastSent` de hoje, com `[skip-email]`. `validate.py` dá **erro** se `data.json` avançar sem o snapshot correspondente, e se preços/market cap/CDS divergirem do snapshot do mesmo pregão.
- Rodapé de todo commit:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` e `Claude-Session: <url da sessão>`.

## Invariantes (o validador cobra)
- Pesos somam ~100; soma dos caps ≈ total (±2); peso × total ≈ cap.
- CDS: bps a 5 anos, data em `meta.cdsAsOf` (aviso se > 30 dias); salto > 2× ou < 0,5× vs. último snapshot é **erro**, > 25% é aviso; `creditNotes[3]` contém "~<cds>" de cada CDS das Mag 7.
- Preço com salto > 25% vs. snapshot anterior é erro (provável digitação).
- `cdsLog` em ordem e sem data posterior a `generated`; snapshots ordenados e únicos por data.
- PD 5a implícita: 1 − exp(−5·s/(1−R)), R = 0,40 (neutra ao risco; compara, não prevê).

## Armadilhas conhecidas
- MCP escreve arquivo inteiro: nunca retipar conteúdo de saída truncada; use `daily.py` e copie o arquivo gerado.
- `get_file_contents` de arquivos grandes salva em disco como JSON `[{type,text}]`.
- Chart.js vem de CDN; em testes de navegador no sandbox é preciso simular (`page.route`).
- O workflow dispara por push em `data.json`; qualquer mudança de caminho/trigger exige edição manual de `.github/workflows` pelo dono.

## Evolução proposta (precisa de decisão do dono)
Separar fundamentos estáticos (trimestrais) dos dados diários; enxugar `cdsLog` e a prosa de `creditNotes`/`audit` (≈70% do `data.json`); reduzir o prompt da tarefa agendada a: "Siga `CLAUDE.md` na raiz do repositório `jmagomez/mag7-financial-dashboard`."
