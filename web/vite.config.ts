import { defineConfig } from "vite";

// base = caminho do GitHub Pages do projeto. O deploy via Actions é um workflow
// que só o dono pode criar (ver docs/proposed/workflows/pages.yml).
export default defineConfig({
  base: "/mag7-financial-dashboard/",
  build: { target: "es2022", sourcemap: true, outDir: "dist" },
});
