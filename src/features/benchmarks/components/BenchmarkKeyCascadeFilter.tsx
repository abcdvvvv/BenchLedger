import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  Combobox,
  Menu,
  MenuButton,
  MenuItem,
  MenuItemCheckbox,
  MenuProvider,
  useComboboxStore,
  useMenuStore
} from "@ariakit/react";
import { FiCheck, FiChevronDown, FiChevronRight, FiMinus, FiSearch } from "react-icons/fi";
import { cn } from "../../../components/ui/cn";
import { buildBenchmarkKeyTree, filterBenchmarkKeyTree, type BenchmarkKeyBenchmarkNode, type BenchmarkKeyGroupNode, type BenchmarkKeyNode, type BenchmarkKeyTreeView } from "../../../lib/benchmark-key-tree";
import {
  Disclosure_Trigger_Icon_Class_Name,
  MenuEmptyState,
  menuItemRowClassName,
  menuSurfaceClassName,
  menuTriggerClassName,
  selectionIndicatorClassName
} from "../../../components/ui/Menu";

type BenchmarkKeyFilterOption = {
  value: string;
  path: string[];
  label: string;
};

type SelectionState = "unchecked" | "checked" | "mixed";

type BenchmarkKeyCascadeFilterProps = {
  options: BenchmarkKeyFilterOption[];
  selectedValues: string[];
  setSelectedValues: (values: string[]) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  stretchWidth?: boolean;
  ariaLabel?: string;
};

type BenchmarkKeyMenuStore = ReturnType<typeof useMenuStore>;

type BenchmarkKeyNodeItemProps = {
  node: BenchmarkKeyNode;
  tree: BenchmarkKeyTreeView;
  parentMenu: BenchmarkKeyMenuStore;
  selectedValueSet: Set<string>;
  toggleValues: (values: string[]) => void;
};

const Root_Menu_Classes = menuSurfaceClassName("max-h-[26rem] overflow-auto");

function selectionState(values: string[], selectedValueSet: Set<string>): SelectionState {
  if (!values.length) return "unchecked";
  let selectedCount = 0;
  for (const value of values) {
    if (selectedValueSet.has(value)) selectedCount += 1;
  }
  if (selectedCount === 0) return "unchecked";
  if (selectedCount === values.length) return "checked";
  return "mixed";
}

function summarizeSelection(count: number, placeholder: string): string {
  if (count === 0) return placeholder;
  if (count === 1) return "1 key selected";
  return `${count} keys selected`;
}

function SelectionIndicator(props: { state: SelectionState }) {
  return (
    <span
      className={selectionIndicatorClassName(props.state)}
      aria-hidden="true"
    >
      {props.state === "checked" ? <FiCheck /> : props.state === "mixed" ? <FiMinus /> : null}
    </span>
  );
}

function BenchmarkKeyLeafItem(props: BenchmarkKeyNodeItemProps & { node: BenchmarkKeyBenchmarkNode }) {
  const { node, parentMenu, selectedValueSet, toggleValues } = props;
  const state = selectionState(node.leafValues, selectedValueSet);
  return (
    <MenuItemCheckbox
      store={parentMenu}
      name="benchmark-key-selection"
      value={node.value}
      checked={state === "checked"}
      hideOnClick={false}
      className={menuItemRowClassName()}
      onClick={() => toggleValues(node.leafValues)}
    >
      <SelectionIndicator state={state} />
      <span className="truncate">{node.path[node.path.length - 1]}</span>
    </MenuItemCheckbox>
  );
}

function BenchmarkKeyBranchItem(props: BenchmarkKeyNodeItemProps & { node: BenchmarkKeyGroupNode }) {
  const { node, tree, parentMenu, selectedValueSet, toggleValues } = props;
  const submenu = useMenuStore({
    parent: parentMenu,
    combobox: null,
    placement: "right-start",
    showTimeout: 100
  });
  const state = selectionState(node.leafValues, selectedValueSet);

  return (
    <MenuProvider store={submenu}>
      <MenuButton
        store={submenu}
        showOnHover
        render={<MenuItem store={parentMenu} hideOnClick={false} focusOnHover blurOnHoverEnd={false} className={menuItemRowClassName({ align: "between" })} />}
        onClick={(event: MouseEvent<HTMLElement>) => {
          event.preventDefault();
          toggleValues(node.leafValues);
        }}
      >
        <SelectionIndicator state={state} />
        <span className="min-w-0 flex-1 truncate text-left">{node.path[node.path.length - 1]}</span>
        <FiChevronRight className="shrink-0 text-gray-400" aria-hidden="true" />
      </MenuButton>
      <Menu store={submenu} portal overlap gutter={4} overflowPadding={8} fitViewport unmountOnHide className={Root_Menu_Classes}>
        {node.childIds.map((childId) => {
          const child = tree.nodesById.get(childId);
          return child ? (
            <BenchmarkKeyNodeItem
              key={child.id}
              node={child}
              tree={tree}
              parentMenu={submenu}
              selectedValueSet={selectedValueSet}
              toggleValues={toggleValues}
            />
          ) : null;
        })}
      </Menu>
    </MenuProvider>
  );
}

function BenchmarkKeyNodeItem(props: BenchmarkKeyNodeItemProps) {
  return props.node.kind === "benchmark"
    ? <BenchmarkKeyLeafItem {...props} node={props.node} />
    : <BenchmarkKeyBranchItem {...props} node={props.node} />;
}

export function BenchmarkKeyCascadeFilter(props: BenchmarkKeyCascadeFilterProps) {
  const {
    options,
    selectedValues,
    setSelectedValues,
    disabled = false,
    className = "",
    placeholder = "Please select benchmark",
    stretchWidth = false,
    ariaLabel = "Benchmark keys"
  } = props;
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const shouldRestoreFocusRef = useRef(false);

  function setMenuOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setSearchValue("");
  }

  const combobox = useComboboxStore({ value: searchValue, setValue: setSearchValue });
  const menu = useMenuStore({ open, setOpen: setMenuOpen, placement: "bottom-start" });
  const tree = useMemo(() => buildBenchmarkKeyTree(options, (option) => option.value, "path"), [options]);
  const filteredTree = useMemo(() => filterBenchmarkKeyTree(tree, searchValue), [searchValue, tree]);
  const selectedValueSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const orderedValues = useMemo(() => options.map((option) => option.value), [options]);
  const isDisabled = disabled || !options.length;
  const benchmarkKeyFilterWidth = useMemo(() => {
    const widestRootLabel = filteredTree.rootIds.reduce((maxWidth, nodeId) => Math.max(maxWidth, filteredTree.nodesById.get(nodeId)?.label.length ?? 0), 0);
    return `min(24rem, max(14rem, ${widestRootLabel + 8}ch))`;
  }, [filteredTree]);
  const benchmarkKeyFilterStyle = stretchWidth ? { width: "100%" } : { width: benchmarkKeyFilterWidth };
  const summaryLabel = useMemo(
    () => summarizeSelection(selectedValues.length, options.length ? placeholder : "No benchmark keys available"),
    [options.length, placeholder, selectedValues.length]
  );
  const inputPlaceholder = open ? "Search keys..." : summaryLabel;

  function commitSelectedValues(nextSelectedValueSet: Set<string>) {
    setSelectedValues(orderedValues.filter((value) => nextSelectedValueSet.has(value)));
  }

  function toggleValues(values: string[]) {
    if (!values.length) return;
    const nextSelectedValueSet = new Set(selectedValues);
    const allSelected = values.every((value) => nextSelectedValueSet.has(value));
    for (const value of values) {
      if (allSelected) nextSelectedValueSet.delete(value);
      else nextSelectedValueSet.add(value);
    }
    commitSelectedValues(nextSelectedValueSet);
  }

  function closeMenu(restoreFocus: boolean) {
    shouldRestoreFocusRef.current = restoreFocus;
    setMenuOpen(false);
  }

  function openMenu() {
    if (isDisabled) return;
    setMenuOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [open]);

  useEffect(() => {
    if (open || !shouldRestoreFocusRef.current) return;
    shouldRestoreFocusRef.current = false;
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [open]);

  useEffect(() => {
    const anchorElement = wrapperRef.current;
    if (!anchorElement) return;
    const disclosureElement = inputRef.current ?? anchorElement;
    menu.setAnchorElement(anchorElement);
    menu.setDisclosureElement(disclosureElement);
  }, [menu, open]);

  useEffect(() => {
    if (!options.length) return;
    const availableValues = new Set(options.map((option) => option.value));
    const nextValues = selectedValues.filter((value) => availableValues.has(value));
    if (nextValues.length === selectedValues.length) return;
    setSelectedValues(nextValues);
  }, [options, selectedValues, setSelectedValues]);

  return (
    <div
      ref={wrapperRef}
      style={benchmarkKeyFilterStyle}
      className={cn("min-w-0", className)}
    >
      <label
        className={menuTriggerClassName({ disabled: isDisabled })}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Combobox
          ref={inputRef}
          store={combobox}
          disabled={isDisabled}
          readOnly={!open}
          className="type-menu min-w-0 flex-1 border-0 bg-transparent outline-none placeholder:text-stone-400 dark:placeholder:text-stone-500"
          placeholder={inputPlaceholder}
          autoComplete="off"
          aria-label={open ? `Search ${ariaLabel.toLocaleLowerCase()}` : ariaLabel}
          onClick={() => {
            if (!open) openMenu();
          }}
          onFocus={() => {
            if (!open && !isDisabled) openMenu();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeMenu(true);
              return;
            }
            if (!open) {
              if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
                event.preventDefault();
                openMenu();
                return;
              }
              if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                setMenuOpen(true);
                setSearchValue(event.key);
              }
              return;
            }
            if (event.key === "ArrowDown") {
              const nextId = menu.first();
              if (nextId) {
                event.preventDefault();
                menu.move(nextId);
              }
            }
          }}
        />
        <span className="shrink-0" aria-hidden="true">
          {open ? <FiSearch className={Disclosure_Trigger_Icon_Class_Name} /> : <FiChevronDown className={Disclosure_Trigger_Icon_Class_Name} />}
        </span>
      </label>

      <Menu
        store={menu}
        portal
        sameWidth
        fitViewport
        gutter={0}
        overflowPadding={8}
        unmountOnHide
        className={Root_Menu_Classes}
        aria-label={ariaLabel}
      >
        {filteredTree.rootIds.length ? (
          filteredTree.rootIds.map((nodeId) => {
            const node = filteredTree.nodesById.get(nodeId);
            return node ? (
              <BenchmarkKeyNodeItem
                key={node.id}
                node={node}
                tree={filteredTree}
                parentMenu={menu}
                selectedValueSet={selectedValueSet}
                toggleValues={toggleValues}
              />
            ) : null;
          })
        ) : (
          <MenuEmptyState>No benchmark keys match your search.</MenuEmptyState>
        )}
      </Menu>
    </div>
  );
}
