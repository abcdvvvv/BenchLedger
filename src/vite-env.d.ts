/// <reference types="vite/client" />

declare module "react-plotly.js/factory";

declare module "plotly.js-basic-dist-min" {
  import Plotly from "plotly.js";
  export default Plotly;
}
