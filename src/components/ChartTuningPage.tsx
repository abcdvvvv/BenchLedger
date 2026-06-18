import { MarkerSymbolMenu } from "./MarkerSymbolMenu";
import { type TrendLineShape, type TrendMarkerFillMode } from "../lib/dashboard";
import { Trend_Marker_Symbol_Options, type TrendMarkerSymbol } from "../lib/trend-marker-symbols";

type ChartTuningPageProps = {
  trendLineShape: TrendLineShape;
  trendMarkerSymbol: TrendMarkerSymbol;
  trendMarkerFillMode: TrendMarkerFillMode;
  onTrendLineShapeChange: (shape: TrendLineShape) => void;
  onTrendMarkerSymbolChange: (symbol: TrendMarkerSymbol) => void;
  onTrendMarkerFillModeChange: (mode: TrendMarkerFillMode) => void;
};

const Trend_Line_Style_Help = "Choose whether the main trend chart connects points with straight line segments or the current smoothed curve.";
const Trend_Marker_Symbol_Help = "Choose the marker symbol used for benchmark data points in trend plots.";
const Trend_Marker_Fill_Help = "Choose whether benchmark data point markers are hollow or filled.";

export function ChartTuningPage(props: ChartTuningPageProps) {
  const {
    trendLineShape,
    trendMarkerSymbol,
    trendMarkerFillMode,
    onTrendLineShapeChange,
    onTrendMarkerSymbolChange,
    onTrendMarkerFillModeChange
  } = props;

  return (
    <>
      <header className="topbar page-topbar">
        <div className="breadcrumb">Benchmarking <span>›</span> Settings</div>
        <div className="page-topbar-row">
          <div className="page-topbar-title">
            <h1>Settings</h1>
          </div>
          <div className="topbar-actions page-topbar-actions page-topbar-actions-empty" aria-hidden="true" />
        </div>
      </header>
      <section className="settings-grid" aria-labelledby="settings-plot-heading">
        <div className="settings-section">
          <h2 id="settings-plot-heading">Plot</h2>
          <div className="settings-section-grid">
            <div className="setting-item">
              <div className="setting-row">
                <div className="setting-copy">
                  <div className="setting-label-row">
                    <h3>Line Interpolation</h3>
                    <button
                      type="button"
                      className="setting-help"
                      aria-label={Trend_Line_Style_Help}
                      title={Trend_Line_Style_Help}
                    >
                      ?
                    </button>
                  </div>
                </div>
                <div
                  className={`segmented-toggle segmented-toggle-${trendLineShape}`}
                  role="group"
                  aria-label="Benchmark trend line style"
                >
                  <button
                    type="button"
                    className={`segment-button${trendLineShape === "line" ? " segment-button-active" : ""}`}
                    onClick={() => onTrendLineShapeChange("line")}
                  >
                    Line
                  </button>
                  <button
                    type="button"
                    className={`segment-button${trendLineShape === "curve" ? " segment-button-active" : ""}`}
                    onClick={() => onTrendLineShapeChange("curve")}
                  >
                    Curve
                  </button>
                </div>
              </div>
            </div>
            <div className="setting-item">
              <div className="setting-row">
                <div className="setting-copy">
                  <div className="setting-label-row">
                    <h3>Data Point Style</h3>
                    <button
                      type="button"
                      className="setting-help"
                      aria-label={Trend_Marker_Symbol_Help}
                      title={Trend_Marker_Symbol_Help}
                    >
                      ?
                    </button>
                  </div>
                </div>
                <MarkerSymbolMenu
                  options={Trend_Marker_Symbol_Options}
                  selectedValue={trendMarkerSymbol}
                  onSelect={onTrendMarkerSymbolChange}
                />
              </div>
            </div>
            <div className="setting-item">
              <div className="setting-row">
                <div className="setting-copy">
                  <div className="setting-label-row">
                    <h3>Data Point Fill</h3>
                    <button
                      type="button"
                      className="setting-help"
                      aria-label={Trend_Marker_Fill_Help}
                      title={Trend_Marker_Fill_Help}
                    >
                      ?
                    </button>
                  </div>
                </div>
                <div
                  className={`segmented-toggle segmented-toggle-${trendMarkerFillMode === "filled" ? "curve" : "line"}`}
                  role="group"
                  aria-label="Benchmark data point fill"
                >
                  <button
                    type="button"
                    className={`segment-button${trendMarkerFillMode === "hollow" ? " segment-button-active" : ""}`}
                    onClick={() => onTrendMarkerFillModeChange("hollow")}
                  >
                    Hollow
                  </button>
                  <button
                    type="button"
                    className={`segment-button${trendMarkerFillMode === "filled" ? " segment-button-active" : ""}`}
                    onClick={() => onTrendMarkerFillModeChange("filled")}
                  >
                    Filled
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
