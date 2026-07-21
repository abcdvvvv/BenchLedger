import { Menu, MenuButton, MenuItem, MenuProvider } from "@ariakit/react";
import { FiCheck } from "react-icons/fi";
import { runHeadline, runIdentityTitle } from "../../../lib/dashboard-data";
import { formatDate, formatDateOnly } from "../../../lib/format";
import type { BenchmarkRun } from "../../../lib/types";
import { cn } from "../../../components/ui/cn";
import { DisclosureTriggerContent, menuItemRowClassName, menuSurfaceClassName, menuTriggerClassName } from "../../../components/ui/Menu";

type RunSelectMenuProps = {
  disabled: boolean;
  runs: BenchmarkRun[];
  selectedRunId: string;
  onSelect: (runId: string) => void;
};

export function RunSelectMenu(props: RunSelectMenuProps) {
  const { disabled, runs, selectedRunId, onSelect } = props;
  const selectedRun = runs.find((run) => run.run_id === selectedRunId) ?? runs[0] ?? null;
  const selectedLabel = selectedRun ? `${runHeadline(selectedRun)} · ${formatDateOnly(selectedRun.measured_at)}` : "No runs available";

  return (
    <MenuProvider>
      <MenuButton
        className={cn(menuTriggerClassName({ disabled }))}
        disabled={disabled}
        title={selectedRun ? `${runIdentityTitle(selectedRun)}\nMeasured: ${formatDate(selectedRun.measured_at)}` : undefined}
      >
        <DisclosureTriggerContent contentClassName="font-mono">{selectedLabel}</DisclosureTriggerContent>
      </MenuButton>
      <Menu
        gutter={0}
        sameWidth
        unmountOnHide
        className={menuSurfaceClassName("max-h-80 overflow-auto")}
      >
        {runs.map((run) => {
          const label = `${runHeadline(run)} · ${formatDateOnly(run.measured_at)}`;
          const isSelected = run.run_id === selectedRunId;
          return (
            <MenuItem
              key={run.run_id}
              className={cn(
                menuItemRowClassName({ state: isSelected ? "selected" : "default" })
              )}
              onClick={() => onSelect(run.run_id)}
              title={`${runIdentityTitle(run)}\nMeasured: ${formatDate(run.measured_at)}`}
            >
              <span className="flex size-4 items-center justify-center" aria-hidden="true">
                {isSelected ? <FiCheck className="size-4" /> : null}
              </span>
              <span className="min-w-0 truncate font-mono">{label}</span>
            </MenuItem>
          );
        })}
      </Menu>
    </MenuProvider>
  );
}
