import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import sqlocal from "sqlocal/vite";

const packageVersion = (JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string }).version;

export default defineConfig({
  base: "./",
  plugins: [sqlocal({ coi: false }), react(), { name: "benchledger-version", transformIndexHtml: (html) => html.replace("<head>", `<head>\n    <meta name="benchledger-version" content="${packageVersion}" />`) }],
  define: { __BENCHLEDGER_VERSION__: JSON.stringify(packageVersion) },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/plotly.js-basic-dist-min/")) return "plotly";
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/@ariakit/react/") ||
            id.includes("/node_modules/react-icons/")
          ) {
            return "vendor";
          }
          return undefined;
        }
      }
    }
  }
});
