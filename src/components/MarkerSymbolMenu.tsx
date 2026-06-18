import { Menu, MenuButton, MenuItem, MenuProvider } from "@ariakit/react";
import { FiChevronDown } from "react-icons/fi";
import type { MarkerSymbolOption, TrendMarkerSymbol } from "../lib/trend-marker-symbols";

type MarkerSymbolMenuProps = {
  options: readonly MarkerSymbolOption[];
  selectedValue: TrendMarkerSymbol;
  onSelect: (value: TrendMarkerSymbol) => void;
};

function MarkerSymbolIcon(props: { option: MarkerSymbolOption }) {
  const { option } = props;

  return (
    <svg viewBox="-16 -16 32 32" aria-hidden="true" className="marker-symbol-icon">
      <path
        d={option.path}
        className={option.noFill ? "marker-symbol-path marker-symbol-path-stroke" : "marker-symbol-path"}
      />
    </svg>
  );
}

export function MarkerSymbolMenu(props: MarkerSymbolMenuProps) {
  const { options, selectedValue, onSelect } = props;
  const selectedOption = options.find((option) => option.value === selectedValue) ?? options[0];

  return (
    <MenuProvider>
      <MenuButton className="group-cascade-trigger marker-symbol-trigger" aria-label="Trend marker symbol">
        <span className="marker-symbol-trigger-icon">
          {selectedOption ? <MarkerSymbolIcon option={selectedOption} /> : null}
        </span>
        <FiChevronDown aria-hidden="true" />
      </MenuButton>
      <Menu gutter={4} sameWidth unmountOnHide className="group-cascade-menu run-select-menu">
        <div role="presentation">
          {options.map((option) => {
            const isSelected = option.value === selectedValue;
            return (
              <MenuItem
                key={option.value}
                className={`group-cascade-item marker-symbol-item${isSelected ? " run-select-item-selected" : ""}`}
                onClick={() => onSelect(option.value)}
                aria-label={option.value}
                title={option.value}
              >
                <MarkerSymbolIcon option={option} />
              </MenuItem>
            );
          })}
        </div>
      </Menu>
    </MenuProvider>
  );
}
