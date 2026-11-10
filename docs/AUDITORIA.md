# Auditoria crítica — repositório e dashboard (09/11/2026)

Escopo: `CLAUDE.md`, `README.md`, `index.html` (861 linhas, 78 KB), `src/*.py`, os dois workflows e os dados.
Cada achado cita a evidência. Severidade: **A**lta (risco de número errado ou falha silenciosa), **M**édia, **B**aixa.
Itens marcados **[PR]** foram tratados neste Pull Request; os demais estão em `docs/ROADMAP.md`.

## 1. Pontos fortes (a preservar)

- Regra de ouro explícita ("nunca inventar número") e rastreabilidade textual de fontes, inclusive de segunda mão.
- Separação diária × trimestral (`data.json` × `fundamentals.json`), entradas dos cálculos auditáveis em `derived`.
- Cálculo derivado no cliente a partir de entradas, sem múltiplos "congelados"; checagem de consistência no rodapé.
- `daily.py` determinístico + `validate.py` como portão (inclusive dentro de `send_email.py`, linha 259).
- Trava de 1 e-mail/dia, `[skip-email]`, CI de validação em todo push.

## 2. Dados e finanças (visão CFA)

| # | Sev | Achado | Evidência | Correção proposta |
|---|---|---|---|---|
| F1 | A | **Mistura de safras de CDS**: Microsoft, Alphabet e Amazon estão em 29/07 (103 dias) e aparecem ao lado de Nvidia (06/11). O ranking e o "recorde" comparam datas diferentes. | `meta.cdsAsOf`; avisos do `validate.py` | Renderizar idade por emissor (esmaecer/hachurar > 30 dias), excluir cotações velhas de rankings e do gráfico de tendência, "n/d (defasado)" no e-mail |
| F2 | A | **Descompasso temporal**: preço de 06/11 ÷ lucro TTM até o 2T'26, e EV com balanço do 2T'26, enquanto 6 das 7 empresas já divulgaram o 3T'26 (Meta/Tesla 21/10, Alphabet/Microsoft 28/10, Amazon 29/10, Apple 02/11). | `fundamentals.json` (`quarterLabel` = Q2 2026); `meta.catalysts` | Exibir a "data-base dos fundamentos" ao lado de cada múltiplo; priorizar a incorporação do 3T; `validate.py` já avisa, mas só no CI |
| F3 | A | **Market cap por ações implícitas** de 27/08: ignora recompras/emissões desde então; erro assumido de até 0,4% e herdado dia após dia. Alphabet: classes A/C/B tratadas por um preço só. | `daily.py::apply`; auditoria "Preços / market cap" | Guardar `sharesOutB` por classe da capa do 10-Q e recalcular a cada trimestre; manter o cap implícito só como fallback sinalizado |
| F4 | A | **Preços de 06/11 derivados** (variação % × fechamento anterior), não cotações de nível. Declarado, mas o erro se propaga ao snapshot. | `history/snapshots.json` (nota de 06/11) | Campo `provenance` por preço (`primary` / `secondary` / `derived`) e bloqueio de `derived` por mais de 1 dia seguido |
| F5 | M | **"Δ dia" cobre mais de um pregão**: faltam snapshots em 12–15/10, 26/10 e 02/11 (6 dias úteis). O rótulo diz "dia". | `renderTable` usa `SP[SP.length-2]`; cálculo sobre `history/snapshots.json` | Rotular "Δ vs. DD/MM" e mostrar o nº de pregões; preencher lacunas retroativamente quando houver fonte |
| F6 | M | **FCF yield e DCF reverso sem ajuste de remuneração em ações (SBC)**: para Meta, Microsoft, Nvidia e Alphabet o FCF é materialmente maior que o FCF "do acionista". | `derived.fcfTTM` | Acrescentar `fcfAfterSbcTTM` e mostrar as duas leituras |
| F7 | M | **WACC único (9%) e g = 3%** em todas as empresas; FCF TTM deprimido pelo CapEx de IA. | `derived.dcfAssumptions` | WACC por empresa (beta, estrutura de capital) e grade de sensibilidade 8–10% |
| F8 | M | **EV exclui arrendamentos, minoritários e participações** (p.ex. Anthropic em Amazon/Alphabet). | auditoria "EV" | EV ajustado como segunda leitura |
| F9 | M | **P/E core parcial**: `oneOffTTM` cobre só algumas empresas; o lucro da Meta no 3T26 inclui encargo jurídico de US$ 9,89 bi. | `derived.oneOffTTM`; auditoria | Ao incorporar o 3T, tratar todos os não recorrentes com a mesma regra, documentada |
| F10 | B | **PD implícita é neutra ao risco** e o tenor de algumas cotações (Nvidia/Meta) não é explicitado pela fonte. | `meta.cdsNote` | Já avisado; acrescentar coluna de tenor/fonte no modelo de dados |

**Modelo de dados — lacuna estrutural.** A proveniência (fonte, data, tipo) vive em texto livre (`cdsNote`, `priceNote`, notas de snapshot).
Isso impede o painel de reagir à qualidade do dado. Ver "Modelo de proveniência" em `docs/ARCHITECTURE.md`.

## 3. Engenharia

| # | Sev | Achado | Evidência | Correção |
|---|---|---|---|---|
| E1 | M | **Trava de e-mail fail-open**: qualquer exceção ao ler `email_log.json` devolve "não enviou hoje" e o envio prossegue. | `send_email.py::already_sent_today` (`except Exception: return False`) | Falhar fechado (não enviar) quando o log existe mas está ilegível |
| E2 | M | **Trava gravada depois do envio, em commit separado feito pela rotina**: se a rotina cai entre os dois passos, a Action roda de novo no próximo push em `data.json`. A própria nota do log diz "status da Action não verificado". | `CLAUDE.md` (ordem 3→4); `history/email_log.json` | Gravar a trava dentro da Action (`contents: write`, commit do bot) ou usar chave de idempotência por data |
| E3 | M | **Workflows sem `permissions`/`concurrency`/`timeout`**; ações fixadas por tag, não por SHA. | `.github/workflows/*.yml` | Versões endurecidas em `docs/proposed/workflows/` [PR]; fixar SHA via Dependabot |
| E4 | M | **Sem testes automatizados** além do `validate.py` (que valida dados, não código); `daily.py` e os cálculos do front não tinham teste. | árvore do repo | `tests/` (16 testes Python) + `web/` (24 testes TS) [PR] |
| E5 | M | **Lógica duplicada em 3 lugares** (Python `common.py`, JS do `index.html`, `mergeData`/`merge()`) sem prova de paridade; o JS arredonda a PD a 1 casa, o Python não. | `common.py::pd5` × `index.html::pd5` | Paridade provada por golden gerado do dashboard real [PR] |
| E6 | M | **Higiene do repositório**: sem `.gitignore` (há `src/__pycache__` não rastreado), sem LICENSE, CODEOWNERS, template de PR, Dependabot, `pyproject`, `.editorconfig`. | `git ls-files` | Adicionados, exceto LICENSE (escolha do dono) [PR] |
| E7 | B | **`snapshots.json` cresce sem limite** e a rotina reenvia o arquivo inteiro a cada commit (hoje 13,6 KB; ~0,9 KB por pregão, ~4–5 KB/semana). | `daily.py::dump_snaps` | Particionar por mês (`history/snapshots/AAAA-MM.json`) na Fase 3 |
| E8 | B | **README e CLAUDE.md sobrepõem** a tabela de arquivos e a descrição da automação; risco de divergência. | ambos | README descreve o produto; processo só no CLAUDE.md |
| E9 | B | **`get_file_contents`/MCP reescreve arquivos inteiros**: risco de truncamento (já documentado em "Armadilhas"). | `CLAUDE.md` | Manter `daily.py` como única escrita de dados; testes de contrato [PR] |

## 4. Front-end, UX/UI e acessibilidade

| # | Sev | Achado | Evidência | Correção |
|---|---|---|---|---|
| U1 | A | **Gráficos sem alternativa textual**: 21 `<canvas>`, só 2 com `role="img"`/`aria-label`; nenhuma tabela equivalente. Leitor de tela não acessa os dados. | `grep canvas/role` em `index.html` | Componente `ChartFrame` com resumo + tabela de dados recolhível (Fase 2) |
| U2 | A | **Texto de fontes externas via `innerHTML` sem escape**: 41 linhas com `innerHTML`; não há função de escape de HTML (a `esc` do arquivo é do CSV). Briefing e fontes vêm de pesquisa na web; `s.url` entra direto em `href` (aceitaria `javascript:`). | `index.html` linhas 615 (`cdsLog`), 661–663 (`briefHead/List/Src`) | `textContent`/escape central + Trusted Types; testes com `<script>` nos dados (Fase 2) |
| U3 | A | **Contraste**: `--faint #5c6480` sobre `#0a0b10` = 3,36:1 (WCAG AA exige 4,5:1 em texto pequeno); usado em legendas de 12,5 px. | cálculo de luminância | Subir para ≥ 4,5:1 (token novo) e testar com axe |
| U4 | M | **Terceiros sem integridade nem CSP**: Chart.js via jsDelivr sem SRI; Google Fonts (requisição externa, FOIT). | `index.html` linhas 7–9 | Chart.js e Inter empacotados pelo Vite; CSP restritiva |
| U5 | M | **Monólito**: ~310 linhas de CSS e ~540 de JS no mesmo arquivo, funções globais, estado global mutável (`DATA` é alterado em `computeDerived`, inclusive `meta.notes[2]` com rótulo "3T'25–2T'26" fixo no código). | `computeDerived` | Módulos tipados, dados imutáveis, textos com rótulos vindos dos dados (Fase 2) |
| U6 | M | **Somente tema escuro**, sem `color-scheme`, sem CSS de impressão; título com `-webkit-text-fill-color: transparent` some em modo de alto contraste. | `<style>` | Tokens de tema claro/escuro, `forced-colors`, `print.css` |
| U7 | M | **Cache e erro**: `?t=Date.now()` anula o cache HTTP; falhas parciais viram `null` silencioso e só o KPI mostra erro. | linhas 849–852 | Cache por ETag, estados de erro/obsoleto por seção |
| U8 | B | **Cor como único canal** em parte dos sinais (positivo/negativo, alerta de CDS). | `.pos/.neg` | Ícone/sinal + padrão além da cor |

## 5. Verificações que contradizem hipóteses iniciais (para registro)

- O envio **é** bloqueado por validação: `send_email.py` chama `validate.py` antes de enviar (linha 259). Não há lacuna aqui.
- O contraste de `--muted` (6,39:1), `--accent` (6,60:1) e `--bad` (7,30:1) passa AA; só `--faint` falha.
