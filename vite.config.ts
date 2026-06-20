import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("plotly.js-dist-min") || id.includes("react-plotly.js")) return "plotly";
          if (id.includes("sql.js")) return "sql";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("@ariakit/react") ||
            id.includes("react-icons")
          ) {
            return "vendor";
          }
          return undefined;
        }
      }
    }
  }
});
