declare module "plotly.js/lib/core" {
  import Plotly from "plotly.js";
  export default Plotly;
}

declare module "plotly.js/lib/scatter" {
  const scatter: Parameters<typeof import("plotly.js").register>[0];
  export default scatter;
}

declare module "plotly.js/lib/icicle" {
  const icicle: Parameters<typeof import("plotly.js").register>[0];
  export default icicle;
}
