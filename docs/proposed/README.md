# Arquivos propostos (precisam de ação do dono)

O token usado pela rotina automática **não pode criar nem editar `.github/workflows/`**. Por isso os
workflows desta proposta ficam aqui, prontos para copiar:

| Arquivo | Destino | Efeito |
|---|---|---|
| `workflows/ci.yml` | `.github/workflows/ci.yml` (substitui `validate.yml`) | lint + validação + pytest + typecheck/testes/build do `web/`, permissões mínimas, cancela execuções obsoletas |
| `workflows/enviar-dashboard.yml` | substitui `.github/workflows/enviar-dashboard.yml` | mesmo gatilho; `permissions: contents: read`, fila única (`concurrency`), `timeout` |
| `workflows/pages.yml` | `.github/workflows/pages.yml` | build Vite + deploy no Pages (só ativar depois da Fase 2) |

Antes do `ci.yml` funcionar, gere e commite o lockfile: `cd web && npm install` (cria `package-lock.json`).
Todos os YAML foram validados como sintaxe; **não foram executados** (não há runner neste ambiente).
