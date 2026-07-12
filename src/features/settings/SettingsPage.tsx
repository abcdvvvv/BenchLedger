import type { ReactNode } from "react";
import { MarkerSymbolMenu } from "../benchmarks/components/MarkerSymbolMenu";
import { PageHeader } from "../../components/common/PageHeader";
import { cn } from "../../components/ui/cn";
import { type TrendLineShape, type TrendMarkerFillMode } from "../../lib/dashboard";
import { Trend_Marker_Symbol_Options, type TrendMarkerSymbol } from "../../lib/trend-marker-symbols";

export type SettingsPageProps = {
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

function SegmentedToggle(props: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const activeIndex = props.options.findIndex((option) => option.value === props.value);
  const activeClassName = activeIndex > 0 ? "translate-x-full" : "translate-x-0";

  return (
    <div
      className="control-frame surface-control relative inline-grid min-h-[2.3rem] min-w-[8rem] grid-cols-2 overflow-hidden p-[0.2rem] shadow-none"
      role="group"
      aria-label={props.ariaLabel}
    >
      <span
        aria-hidden="true"
        className={cn(
          "radius-theme absolute top-[0.2rem] bottom-[0.2rem] left-[0.2rem] z-0 w-[calc((100%-0.4rem)/2)] transition-transform",
          activeClassName
        )}
        style={{ backgroundColor: "var(--color-text-theme-brand)" }}
      />
      {props.options.map((option) => {
        const active = option.value === props.value;
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              "radius-theme relative z-10 border-0 bg-transparent px-3 text-center text-[0.82rem] font-semibold transition",
              active ? "text-stone-950" : "text-stone-500 dark:text-stone-400"
            )}
            onClick={() => props.onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SettingRow(props: {
  title: string;
  help: string;
  control: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-[1rem] leading-5 font-semibold text-[var(--color-text-theme-strong)]">{props.title}</h3>
            <button
              type="button"
              className="surface-subtle inline-grid size-5 shrink-0 place-items-center rounded-full border text-[0.78rem] leading-none font-bold text-[var(--color-text-theme-muted)] transition hover:text-theme-brand"
              aria-label={props.help}
              title={props.help}
            >
              ?
            </button>
          </div>
        </div>
        <div className="shrink-0">
          {props.control}
        </div>
      </div>
    </div>
  );
}

function SettingsSection(props: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3" aria-labelledby="settings-plot-heading">
      <h2 id="settings-plot-heading" className="m-0 text-[1.1rem] font-semibold text-[var(--color-text-theme-strong)]">
        {props.title}
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,25rem),1fr))] gap-4">
        {props.children}
      </div>
    </section>
  );
}

export function SettingsPage(props: SettingsPageProps) {
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
      <PageHeader eyebrow="Benchmarking › Settings" title="Settings" />
      <div className="grid gap-6">
        <SettingsSection title="Plot">
          <SettingRow
            title="Line Interpolation"
            help={Trend_Line_Style_Help}
            control={
              <SegmentedToggle
                value={trendLineShape}
                options={[{ value: "line", label: "Line" }, { value: "curve", label: "Curve" }]}
                onChange={(value) => onTrendLineShapeChange(value as TrendLineShape)}
                ariaLabel="Benchmark trend line style"
              />
            }
          />
          <SettingRow
            title="Data Point Style"
            help={Trend_Marker_Symbol_Help}
            control={
              <div className="w-full min-w-[7rem] sm:w-auto">
                <MarkerSymbolMenu
                  options={Trend_Marker_Symbol_Options}
                  selectedValue={trendMarkerSymbol}
                  onSelect={onTrendMarkerSymbolChange}
                />
              </div>
            }
          />
          <SettingRow
            title="Data Point Fill"
            help={Trend_Marker_Fill_Help}
            control={
              <SegmentedToggle
                value={trendMarkerFillMode}
                options={[{ value: "hollow", label: "Hollow" }, { value: "filled", label: "Filled" }]}
                onChange={(value) => onTrendMarkerFillModeChange(value as TrendMarkerFillMode)}
                ariaLabel="Benchmark data point fill"
              />
            }
          />
        </SettingsSection>
      </div>
    </>
  );
}
