import { Menu, MenuButton, MenuItem, MenuProvider } from "@ariakit/react";
import { FiCheck, FiChevronDown } from "react-icons/fi";
import { runHeadline } from "../lib/dashboard";
import { formatDate, formatDateOnly } from "../lib/format";
import type { BenchmarkRun } from "../lib/types";

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
        className="group-cascade-trigger"
        disabled={disabled}
        title={selectedRun ? formatDate(selectedRun.measured_at) : undefined}
      >
        <span className="group-cascade-trigger-label">{selectedLabel}</span>
        <FiChevronDown aria-hidden="true" />
      </MenuButton>
      <Menu gutter={4} sameWidth unmountOnHide className="group-cascade-menu run-select-menu">
        {runs.map((run) => {
          const label = `${runHeadline(run)} · ${formatDateOnly(run.measured_at)}`;
          const isSelected = run.run_id === selectedRunId;

          return (
            <MenuItem
              key={run.run_id}
              className={`group-cascade-item run-select-item${isSelected ? " run-select-item-selected" : ""}`}
              onClick={() => onSelect(run.run_id)}
              title={formatDate(run.measured_at)}
            >
              <span className="run-select-item-indicator" aria-hidden="true">
                {isSelected ? <FiCheck /> : null}
              </span>
              <span className="group-cascade-item-label">{label}</span>
            </MenuItem>
          );
        })}
      </Menu>
    </MenuProvider>
  );
}
