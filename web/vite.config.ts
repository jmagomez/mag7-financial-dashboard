import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

// base = caminho do GitHub Pages do projeto. O deploy via Actions é um workflow
// que só o dono pode criar (ver docs/proposed/workflows/pages.yml).
const BASE = "/mag7-financial-dashboard/";
const DATA = ["data.json", "fundamentals.json", "history/snapshots.json"];
const repoFile = (n: string): Buffer => readFileSync(fileURLToPath(new URL(`../${n}`, import.meta.url)));

/** Serve (dev) e copia para dist (build) os JSON da raiz do repositório: o front lê os dados em tempo de execução. */
function repoData(): Plugin {
  return {
    name: "repo-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = DATA.find((n) => (req.url ?? "").split("?")[0] === BASE + n);
        if (!name) return next();
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(repoFile(name));
      });
    },
    generateBundle() {
      for (const n of DATA) this.emitFile({ type: "asset", fileName: n, source: repoFile(n) });
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [repoData()],
  build: { target: "es2022", sourcemap: true, outDir: "dist" },
});
