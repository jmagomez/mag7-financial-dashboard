// Ponto de entrada da v2. Fase 1: só prova que o núcleo financeiro compila e roda no navegador.
// A UI (abas, gráficos, tabelas) será portada na Fase 2 (docs/ROADMAP.md).
import { pd5 } from "./lib/finance.ts";

const app = document.getElementById("app");
if (app) {
  const p = document.createElement("p");
  p.textContent = `PD 5a implícita em 100 bps de CDS (R = 40%): ${pd5(100)}%`;
  app.append(p);
}
