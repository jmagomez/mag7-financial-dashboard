# Fase 4 — workflows propostos (ação do dono)

O token da rotina não cria nem edita `.github/workflows/`. Estes arquivos estão prontos para copiar.

| Arquivo | Destino | O que muda |
|---|---|---|
| `enviar-dashboard.yml` | `.github/workflows/enviar-dashboard.yml` | A Action grava a trava do dia (`history/email_log.json`) depois de enviar: `contents: write`, `MAG7_WRITE_LOG=1`, fila única (`concurrency`), `timeout`, ações por SHA. Mesmo gatilho (push em `data.json`). |
| `ci.yml`, `pages.yml`, `validate.yml` | os de mesmo nome em `.github/workflows/` | Só trocam `@v4`/`@v5`/`@v3` pelo SHA do commit da versão (comentário `# vN`). Nada mais muda. |

SHAs (consultados no GitHub em 16/11/2026): checkout v4 `11d5960a`, setup-python v5 `a26af69b`, setup-node v4 `49933ea5`, upload-pages-artifact v3 `56afc609`, deploy-pages v4 `d6db9016`. Confira cada um na página de tags da ação antes de aplicar.

## Ordem segura
1. Merge deste PR (o `send_email.py` novo é inofensivo sem `MAG7_WRITE_LOG`).
2. Copie os quatro YAML para `.github/workflows/` num único commit.
3. Dispare `enviar-dashboard` por `workflow_dispatch` uma vez e confira se `history/email_log.json` foi commitado pela Action (`[skip-email]`).
4. Só então a rotina diária deixa de gravar `email_log.json` (ajustar o passo 4 de "E-mail: exatamente um por dia" no `CLAUDE.md`). Até lá, as duas gravações coincidem (mesma data), sem dano.

Risco: se o push da trava falhar (ex.: proteção de branch exigindo PR), a Action avisa com `::warning::` e a trava volta a ser gravada à mão. Não foram executados (não há runner aqui); os YAML foram validados só como sintaxe.
