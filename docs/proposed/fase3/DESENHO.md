# Fase 3 — desenho proposto (nada aqui está implementado)

Este documento responde aos itens 1 a 3 pendentes da Fase 3 do roadmap. **Nenhum arquivo de dados, script de produção ou workflow muda por causa dele.** Cada passo abaixo vira um PR próprio, só depois de o dono aprovar o desenho. Os números são do estado de 13/11/2026.

## 1. Onde a proveniência já está e onde falta

O roadmap pede que cada valor externo seja `{value, asOf, source, tier}`. Boa parte disso já existe, por blocos:

- `data.json` (diário): `meta.provenance` guarda nível e data de preços, market cap, pesos e CDS, gravada por `daily.py` e validada (Fase 3a e 3b).
- `fundamentals.json`, blocos recentes de `derived`: `sharesOut`, `waccInputs`, `sbcTTM` e `evAdjust` já trazem, por empresa, valor, data (`asOf`) e fonte (`label` e `url` https), com validador e teste.
- `fundamentals.json`, blocos antigos de `derived`: `balanceQ2_2026`, `fcfTTM`, `fwdPE`, `ebitdaImplB`, `fwdEPS` e `oneOffTTM` são números soltos por empresa. A data e a fonte estão só numa nota de texto do bloco (`balanceNote`, `fcfTTMNote` etc.), o que o validador não consegue conferir e o painel não consegue mostrar por número.

Ou seja, o esquema v2 **só agrega valor nos seis blocos antigos**. Os quatro recentes já estão no formato que o roadmap quer, com nomes de campo ligeiramente diferentes (`valueB`, `total`, `beta`).

## 2. Esquema v2 de `fundamentals.json` (item 1 do roadmap)

Formato proposto para cada valor dos seis blocos antigos, por empresa:

```json
"fcfTTM": { "AAPL": { "value": 108, "asOf": "2026-06-27", "tier": "primary", "source": { "label": "...", "url": "https://..." } } }
```

Regras:

- `tier` segue os três níveis que já existem (`primary`, `secondary`, `derived`). Consenso de agregadores (`fwdPE`) é `secondary`; `ebitdaImplB` e `fwdEPS` são `derived` (reescalados do múltiplo de agosto); balanço e FCF de 10-Q ou release são `primary`.
- Os **nomes dos blocos não mudam** (`balanceQ2_2026` continua com esse nome), porque o painel, o validador e a rotina mensal dependem deles.
- Sem dado confirmado, a empresa fica de fora do bloco (n/d), como hoje. Nunca estimar.

### Migração em passos pequenos e reversíveis

1. **Leitor duplo, sem mudar dado.** Uma função `value_of(x)` em `src/common.py` e o equivalente em `web/src/lib/` aceitam número solto ou objeto `{value, ...}`. O validador passa a aceitar os dois formatos. Teste: os mesmos dados dão exatamente os mesmos resultados. Nada visível muda.
2. **Um bloco por PR**, começando pelo mais simples (`fcfTTM`). Cada PR converte o bloco, e um teste compara os números exibidos (painel, CSV de 39 colunas e e-mail em `--dry-run`) antes e depois: tem de ser byte a byte igual.
3. **Validação nova só depois de os seis blocos migrarem:** data e fonte obrigatórias, aviso de idade (como `SBC_MAX_DAYS`), e o painel passa a mostrar a data de cada número.
4. Só então remover o formato antigo e as notas de texto redundantes.

Risco principal: `send_email.py` e `daily.py` leem `derived` por `merge()`. Por isso o passo 1 vem antes de qualquer conversão, e cada PR roda o `--dry-run` do e-mail e compara a saída.

Custo: `fundamentals.json` passa de ~29 KB para ~35 KB. Como o arquivo só muda uma vez por trimestre, o custo de reenvio é irrelevante.

## 3. Partição dos snapshots (item 3 do roadmap)

### Por que e quando

`history/snapshots.json` tem hoje 20 snapshots e 16 KB (~760 bytes por pregão; 4,4 KB comprimido). Em um ano de pregões isso vira ~190 KB. Para quem lê (painel, e-mail, validador) é pouco. **O custo real é de escrita:** a rotina diária grava pelo MCP do GitHub, que exige o conteúdo integral do arquivo a cada commit. Um arquivo de ~190 KB reenviado todo dia pesa muito mais do que 16 KB.

Gatilho sugerido para fazer: `snapshots.json` acima de ~100 KB (cerca de 130 pregões, por volta de abril de 2027). Antes disso, a partição é custo sem benefício.

### Formato proposto

- `history/snapshots/AAAA-MM.json`: um arquivo por mês, com o mesmo formato de hoje (`_doc` e `snapshots`). A rotina diária regrava só o mês corrente, ~15 KB.
- `history/snapshots/index.json`: lista dos meses existentes, em ordem, para o painel saber o que buscar sem listar diretório.
- `history/snapshots.json` fica durante a transição como cópia do período antigo e some só no último passo.

### Quem lê e o que muda

| Leitor | Hoje | Depois |
|---|---|---|
| `daily.py` | lê e grava o arquivo único | lê o mês corrente e o anterior (para o snapshot do pregão anterior), grava o corrente |
| `validate.py` | lê o arquivo inteiro | lê todos os meses pelo índice |
| `send_email.py` | usa os dois últimos snapshots | mês corrente e anterior |
| painel (`main.ts`, `vite.config.ts`) | busca `history/snapshots.json` | busca o índice e os últimos N meses; o gráfico de tendência usa o que carregou |
| testes | quatro arquivos de teste leem o caminho fixo | passam a usar uma função única `load_snapshots()` |

### O que exige ação do dono

- **Um único ajuste em `pages.yml`:** a linha `cp history/snapshots.json web/dist/history/` passa a copiar a pasta (`cp -r history/snapshots web/dist/history/`). Na transição, copiar os dois.
- **O gatilho do e-mail não muda**, desde que `data.json` fique onde está.

### Sobre mover os dados para `data/`

O roadmap também menciona mover os arquivos para uma pasta `data/`. **Recomendo não fazer:** exigiria mudar o gatilho do e-mail (`paths: data.json`), o `pages.yml`, a rotina diária, o validador e o link público dos dados, para ganho apenas estético. Se o dono quiser mesmo assim, é um PR separado e feito por último.

## 4. Ordem sugerida

1. Leitor duplo (`value_of`) e validador tolerante. Sem mudança visível.
2. Conversão dos seis blocos, um PR por bloco, com teste de igualdade byte a byte.
3. Validação nova e datas por número no painel.
4. Partição dos snapshots, só quando o gatilho de tamanho chegar (precisa do ajuste no `pages.yml`).
5. Remoção dos formatos antigos.

## 5. Decisões que dependem do dono

- Aprovar o formato `{value, asOf, tier, source}` com esses nomes de campo, ou propor outros.
- Confirmar que `data.json` e `fundamentals.json` ficam onde estão (recomendado).
- Quando chegar a hora da partição, aplicar o ajuste em `pages.yml`.
- Dizer se quer que o passo 1 comece agora ou só depois da incorporação do 3T 2026 (Nvidia ainda não divulgou o trimestre; a rotina mensal mexe em `fundamentals.json` nesse momento, e convém não sobrepor as duas mudanças).
