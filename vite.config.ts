import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/plotly.js-basic-dist-min/")) return "plotly";
          if (id.includes("/node_modules/sql.js/")) return "sql";
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
