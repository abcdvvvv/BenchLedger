import type { ReactNode } from "react";
import { MarkerSymbolMenu } from "../benchmarks/components/MarkerSymbolMenu";
import { PageHeader } from "../../components/common/PageHeader";
import { SegmentedToggle } from "../../components/ui/SegmentedToggle";
import { type ThemeMode, type TrendLineShape, type TrendMarkerFillMode } from "../../lib/dashboard-settings";
import { Trend_Marker_Symbol_Options, type TrendMarkerSymbol } from "../../lib/trend-marker-symbols";

export type SettingsPageProps = {
  theme: ThemeMode;
  trendLineShape: TrendLineShape;
  trendMarkerSymbol: TrendMarkerSymbol;
  trendMarkerFillMode: TrendMarkerFillMode;
  onThemeChange: (theme: ThemeMode) => void;
  onTrendLineShapeChange: (shape: TrendLineShape) => void;
  onTrendMarkerSymbolChange: (symbol: TrendMarkerSymbol) => void;
  onTrendMarkerFillModeChange: (mode: TrendMarkerFillMode) => void;
};

const Theme_Help = "Choose the interface color theme.";
const Trend_Line_Style_Help = "Choose whether the main trend chart connects points with straight line segments or the current smoothed curve.";
const Trend_Marker_Symbol_Help = "Choose the marker symbol used for benchmark data points in trend plots.";
const Trend_Marker_Fill_Help = "Choose whether benchmark data point markers are hollow or filled.";

function SettingRow(props: {
  title: string;
  help: string;
  control: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h3 className="text-[1rem] leading-5 font-semibold text-[var(--color-text-theme-strong)]">{props.title}</h3>
          <p className="type-body-muted mt-1 max-w-2xl">{props.help}</p>
        </div>
        <div className="shrink-0">
          {props.control}
        </div>
      </div>
    </div>
  );
}

function SettingsSection(props: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3" aria-labelledby={props.id}>
      <h2 id={props.id} className="m-0 text-[1.1rem] font-semibold text-[var(--color-text-theme-strong)]">
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
    theme,
    trendLineShape,
    trendMarkerSymbol,
    trendMarkerFillMode,
    onThemeChange,
    onTrendLineShapeChange,
    onTrendMarkerSymbolChange,
    onTrendMarkerFillModeChange
  } = props;

  return (
    <>
      <PageHeader eyebrow="Benchmarking › Settings" title="Settings" />
      <div className="grid gap-6">
        <SettingsSection id="settings-appearance-heading" title="Appearance">
          <SettingRow
            title="Theme"
            help={Theme_Help}
            control={
              <SegmentedToggle
                value={theme}
                options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
                onChange={(value) => onThemeChange(value as ThemeMode)}
                ariaLabel="Interface theme"
                className="min-w-[8rem]"
                buttonClassName="px-3"
              />
            }
          />
        </SettingsSection>
        <SettingsSection id="settings-plot-heading" title="Plot">
          <SettingRow
            title="Line Interpolation"
            help={Trend_Line_Style_Help}
            control={
              <SegmentedToggle
                value={trendLineShape}
                options={[{ value: "line", label: "Line" }, { value: "curve", label: "Curve" }]}
                onChange={(value) => onTrendLineShapeChange(value as TrendLineShape)}
                ariaLabel="Benchmark trend line style"
                className="min-w-[8rem]"
                buttonClassName="px-3"
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
                className="min-w-[8rem]"
                buttonClassName="px-3"
              />
            }
          />
        </SettingsSection>
      </div>
    </>
  );
}
