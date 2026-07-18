import createPlotlyComponentModule from "react-plotly.js/factory";
import Plotly from "../../../lib/plotly";

const createPlotlyComponent =
  typeof createPlotlyComponentModule === "function"
    ? createPlotlyComponentModule
    : createPlotlyComponentModule.default;

const Plot = createPlotlyComponent(Plotly);

export default Plot;
