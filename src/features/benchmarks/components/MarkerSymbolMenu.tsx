import { Menu, MenuButton, MenuItem, MenuProvider } from "@ariakit/react";
import type { MarkerSymbolOption, TrendMarkerSymbol } from "../../../lib/trend-marker-symbols";
import { cn } from "../../../components/ui/cn";
import { DisclosureTriggerContent, menuItemRowClassName, menuSurfaceClassName, menuTriggerClassName } from "../../../components/ui/Menu";

type MarkerSymbolMenuProps = {
  options: readonly MarkerSymbolOption[];
  selectedValue: TrendMarkerSymbol;
  onSelect: (value: TrendMarkerSymbol) => void;
};

function MarkerSymbolIcon(props: { option: MarkerSymbolOption; className?: string }) {
  const { option, className } = props;
  return (
    <svg viewBox="-16 -16 32 32" aria-hidden="true" className={className}>
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
      <MenuButton
        className={menuTriggerClassName()}
        aria-label="Trend marker symbol"
      >
        <DisclosureTriggerContent contentClassName="inline-flex w-full items-center justify-center text-gray-700 dark:text-gray-200">
          {selectedOption ? <MarkerSymbolIcon option={selectedOption} className="size-4" /> : null}
        </DisclosureTriggerContent>
      </MenuButton>
      <Menu
        gutter={6}
        unmountOnHide
        className={menuSurfaceClassName("w-[11rem] max-w-[calc(100vw-2rem)]")}
      >
        <div role="presentation" className="grid grid-cols-4 gap-2">
          {options.map((option) => {
            const isSelected = option.value === selectedValue;
            return (
              <MenuItem
                key={option.value}
                className={cn(
                  menuItemRowClassName({ state: isSelected ? "selected" : "default", align: "center" }),
                  "size-10 p-0"
                )}
                onClick={() => onSelect(option.value)}
                aria-label={option.value}
                title={option.value}
              >
                <MarkerSymbolIcon option={option} className="size-5" />
              </MenuItem>
            );
          })}
        </div>
      </Menu>
    </MenuProvider>
  );
}
