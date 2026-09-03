import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Plotly is intentionally preloaded at startup. Charting is a core BenchLedger workflow, so paying the load cost early avoids delaying the first plot.
// Do not convert this import to lazy loading: the startup cost is deliberate so the first chart opens without an extra loading pause.
import "./lib/plotly";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
