import type { TrendLineShape } from "../lib/dashboard";

type ChartTuningPageProps = {
  trendLineShape: TrendLineShape;
  onTrendLineShapeChange: (shape: TrendLineShape) => void;
};

export function ChartTuningPage(props: ChartTuningPageProps) {
  const { trendLineShape, onTrendLineShapeChange } = props;

  return (
    <>
      <header className="topbar page-topbar">
        <div className="breadcrumb">Benchmarking <span>›</span> Chart Tuning</div>
        <div className="page-topbar-row">
          <div className="page-topbar-title">
            <h1>Chart Tuning</h1>
          </div>
          <div className="topbar-actions page-topbar-actions page-topbar-actions-empty" aria-hidden="true" />
        </div>
        <p>Small display preferences for benchmark charts. These settings are saved in this browser.</p>
      </header>
      <section className="settings-grid">
        <article className="surface-card panel setting-card">
          <div>
            <h2>Benchmark Trend Line Style</h2>
            <p>Choose whether the main trend chart connects points with straight line segments or the current smoothed curve.</p>
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
        </article>
      </section>
    </>
  );
}
