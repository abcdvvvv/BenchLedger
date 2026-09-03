import { Menu, MenuButton, MenuItem, MenuProvider } from "@ariakit/react";
import { FiCheck } from "react-icons/fi";
import { runHeadline, runIdentityTitle } from "../../../lib/dashboard-data";
import { formatDate, formatDateOnly } from "../../../lib/format";
import type { DimensionSelectionPoint } from "../../../lib/dimension-selector";
import type { BenchmarkRun } from "../../../lib/types";
import { DisclosureTriggerContent, menuItemRowClassName, menuSurfaceClassName, menuTriggerClassName } from "../../../components/ui/Menu";

type DimensionPointSelectMenuProps = { disabled: boolean; points: readonly DimensionSelectionPoint[]; runsByPoint: ReadonlyMap<string, readonly BenchmarkRun[]>; preferRunIdentity: boolean; selectedPointKey: string; onSelect: (pointKey: string) => void; ariaLabel: string; };

function measuredTime(run: BenchmarkRun): number { const value = Date.parse(run.measured_at); return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY; }
function newestRun(runs: readonly BenchmarkRun[]): BenchmarkRun | null { return runs.reduce<BenchmarkRun | null>((latest, run) => !latest || measuredTime(run) > measuredTime(latest) ? run : latest, null); }

function preferredPointRun(runs: readonly BenchmarkRun[]): BenchmarkRun | null { return newestRun(runs.filter((run) => (run.run_metadata.source?.tags?.length ?? 0) > 0)) ?? newestRun(runs); }

function pointPresentation(point: DimensionSelectionPoint, runsByPoint: ReadonlyMap<string, readonly BenchmarkRun[]>, preferRunIdentity: boolean) {
  const run = preferRunIdentity ? preferredPointRun(runsByPoint.get(point.key) ?? []) : null;
  return run ? { label: `${runHeadline(run)} · ${formatDateOnly(run.measured_at)}`, title: `${runIdentityTitle(run)}\nMeasured: ${formatDate(run.measured_at)}` } : { label: point.label, title: undefined };
}

export function DimensionPointSelectMenu(props: DimensionPointSelectMenuProps) {
  const selected = props.points.find((point) => point.key === props.selectedPointKey) ?? props.points[0] ?? null;
  const selectedPresentation = selected ? pointPresentation(selected, props.runsByPoint, props.preferRunIdentity) : null;
  const orderedPoints = props.preferRunIdentity ? Array.from(props.runsByPoint.keys(), (key) => props.points.find((point) => point.key === key)).filter((point): point is DimensionSelectionPoint => point !== undefined) : props.points;
  return (
    <MenuProvider>
      <MenuButton className={menuTriggerClassName({ disabled: props.disabled })} disabled={props.disabled} aria-label={props.ariaLabel} title={selectedPresentation?.title}>
        <DisclosureTriggerContent contentClassName="font-mono">{selectedPresentation?.label ?? "No points available"}</DisclosureTriggerContent>
      </MenuButton>
      <Menu gutter={0} sameWidth unmountOnHide className={menuSurfaceClassName("max-h-80 overflow-auto")}>
        {orderedPoints.map((point) => {
          const isSelected = point.key === selected?.key;
          const presentation = pointPresentation(point, props.runsByPoint, props.preferRunIdentity);
          return (
            <MenuItem key={point.key} className={menuItemRowClassName({ state: isSelected ? "selected" : "default" })} onClick={() => props.onSelect(point.key)} title={presentation.title}>
              <span className="flex size-4 items-center justify-center" aria-hidden="true">{isSelected ? <FiCheck className="size-4" /> : null}</span>
              <span className="min-w-0 flex-1 truncate font-mono">{presentation.label}</span>
              {point.configurationKeys.length > 1 ? <span className="type-meta shrink-0">{point.configurationKeys.length} configs</span> : null}
            </MenuItem>
          );
        })}
      </Menu>
    </MenuProvider>
  );
}
