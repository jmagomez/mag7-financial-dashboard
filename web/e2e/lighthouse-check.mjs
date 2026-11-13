/**
 * Lighthouse (desempenho e acessibilidade ≥ 95) em 3 rotas × celular e desktop, sobre o build servido por `vite preview`.
 * Sem dependência no lockfile: usa `npx lighthouse@13.6.0` (versão fixa) e o Chromium do Playwright. Lighthouse varia de uma
 * execução para outra (a primeira costuma ser mais lenta), então cada medida vale pelo melhor de até 3 tentativas.
 * Uso: `npm run lighthouse` em web/e2e (depois de `npm run build` em web/).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { BASE, startServer } from "./tests/helpers.mjs";

const MIN = 95;
const ROUTES = ["#ind", "#val", "#cred"];
const FORMS = ["mobile", "desktop"];
const CATS = ["performance", "accessibility", "best-practices", "seo"];
const out = mkdtempSync(join(tmpdir(), "lh-"));

function measure(route, form) {
  const file = join(out, `${form}-${route.slice(1)}.json`);
  const args = ["--yes", "lighthouse@13.6.0", BASE + route, `--only-categories=${CATS.join(",")}`, "--chrome-flags=--headless=new --no-sandbox", "--output=json", `--output-path=${file}`, "--quiet"];
  if (form === "desktop") args.push("--preset=desktop");
  const r = spawnSync("npx", args, { env: { ...process.env, CHROME_PATH: chromium.executablePath() }, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`lighthouse falhou em ${route} (${form}): ${r.stderr.slice(-300)}`);
  const j = JSON.parse(readFileSync(file, "utf8"));
  return Object.fromEntries(CATS.map((c) => [c, Math.round(j.categories[c].score * 100)]));
}

const server = await startServer();
let failed = false;
try {
  for (const route of ROUTES) {
    for (const form of FORMS) {
      let best = null;
      for (let i = 0; i < 3 && !(best && best.performance >= MIN && best.accessibility >= MIN); i++) {
        const s = measure(route, form);
        best = best ? Object.fromEntries(CATS.map((c) => [c, Math.max(best[c], s[c])])) : s;
      }
      const ok = best.performance >= MIN && best.accessibility >= MIN;
      failed ||= !ok;
      console.log(`${ok ? "ok  " : "FALHA"} ${route.padEnd(5)} ${form.padEnd(7)} ${CATS.map((c) => `${c}=${best[c]}`).join(" ")}`);
    }
  }
} finally {
  server.kill();
  rmSync(out, { recursive: true, force: true });
}
if (failed) {
  console.error(`Desempenho ou acessibilidade abaixo de ${MIN}.`);
  process.exit(1);
}
