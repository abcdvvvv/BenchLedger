/// <reference types="vite/client" />

declare const __BENCHLEDGER_VERSION__: string;

declare module "plotly.js-basic-dist-min" {
  import Plotly from "plotly.js";
  export default Plotly;
}
