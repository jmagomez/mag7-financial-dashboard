/** Servidor e navegador compartilhados pelos testes e2e: `vite preview` do build de web/ (exige `npm run build` antes). */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const WEB = fileURLToPath(new URL("../../", import.meta.url));
const PORT = Number(process.env.E2E_PORT ?? 4173);
export const ORIGIN = `http://localhost:${PORT}`;
export const BASE = `${ORIGIN}/mag7-financial-dashboard/`;
export const AXE_SOURCE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
export const ROUTES = ["#ind", "#ind-quarter", "#val", "#cred", "#hist", "#hist-fcf"];

export async function startServer() {
  if (!existsSync(`${WEB}dist/index.html`)) throw new Error("web/dist não existe: rode `npm run build` em web/ antes do e2e");
  const vite = fileURLToPath(new URL("../../node_modules/vite/bin/vite.js", import.meta.url));
  const proc = spawn(process.execPath, [vite, "preview", "--port", String(PORT), "--strictPort", "--host", "localhost"], { cwd: WEB, stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) return proc;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  proc.kill();
  throw new Error("vite preview não respondeu em 10 s");
}

export const launch = () => chromium.launch();

/** Abre uma rota e espera o painel carregar (o botão de CSV só existe com dados prontos). */
export async function open(browser, hash, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 900 }, acceptDownloads: true, ...opts });
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  const external = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(ORIGIN) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) external.push(r.url());
  });
  await page.goto(BASE + hash);
  await page.waitForSelector("#csv-btn");
  return { context, page, problems, external };
}
