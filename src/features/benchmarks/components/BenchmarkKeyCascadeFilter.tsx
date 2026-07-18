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
import { comparePath } from "../../../lib/dashboard-data";
import { cn } from "../../../components/ui/cn";
import {
  Disclosure_Trigger_Icon_Class_Name,
  MenuEmptyState,
  menuItemRowClassName,
  menuSurfaceClassName,
  menuTriggerClassName,
  selectionIndicatorClassName
} from "../../../components/ui/Menu";

export type BenchmarkKeyFilterOption = {
  value: string;
  path: string[];
  label: string;
};

type SelectionState = "unchecked" | "checked" | "mixed";

type BenchmarkKeyLeafNode = {
  kind: "leaf";
  id: string;
  value: string;
  label: string;
  segment: string;
  path: string[];
  allLeafValues: string[];
  visibleLeafValues: string[];
};

type BenchmarkKeyBranchNode = {
  kind: "branch";
  id: string;
  segment: string;
  path: string[];
  children: BenchmarkKeyTreeNode[];
  allLeafValues: string[];
  visibleLeafValues: string[];
};

type BenchmarkKeyTreeNode = BenchmarkKeyLeafNode | BenchmarkKeyBranchNode;

type BenchmarkKeyCascadeFilterProps = {
  options: BenchmarkKeyFilterOption[];
  selectedValues: string[];
  setSelectedValues: (values: string[]) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  stretchWidth?: boolean;
};

type BenchmarkKeyMenuStore = ReturnType<typeof useMenuStore>;

type BenchmarkKeyNodeItemProps = {
  node: BenchmarkKeyTreeNode;
  parentMenu: BenchmarkKeyMenuStore;
  selectedValueSet: Set<string>;
  toggleValues: (values: string[]) => void;
};

const Root_Menu_Classes = menuSurfaceClassName("max-h-[26rem] overflow-auto");

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

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

function sortOptions(options: BenchmarkKeyFilterOption[]): BenchmarkKeyFilterOption[] {
  return [...options].sort((left, right) => {
    const pathOrder = comparePath(left.path, right.path);
    if (pathOrder !== 0) return pathOrder;
    return left.label.localeCompare(right.label) || left.value.localeCompare(right.value);
  });
}

function buildTree(options: BenchmarkKeyFilterOption[]): BenchmarkKeyTreeNode[] {
  type MutableBranch = {
    kind: "branch";
    id: string;
    segment: string;
    path: string[];
    children: BenchmarkKeyTreeNode[];
    allLeafValues: string[];
    visibleLeafValues: string[];
  };

  const root: MutableBranch = {
    kind: "branch",
    id: "__root__",
    segment: "",
    path: [],
    children: [],
    allLeafValues: [],
    visibleLeafValues: []
  };
  const branchByPath = new Map<string, MutableBranch>([["[]", root]]);

  for (const option of sortOptions(options)) {
    const path = option.path.length ? option.path : [option.label || option.value];
    let parent = root;
    for (let depth = 0; depth < path.length - 1; depth += 1) {
      const branchPath = path.slice(0, depth + 1);
      const branchId = JSON.stringify(branchPath);
      let branch = branchByPath.get(branchId);
      if (!branch) {
        branch = {
          kind: "branch",
          id: branchId,
          segment: branchPath[branchPath.length - 1],
          path: branchPath,
          children: [],
          allLeafValues: [],
          visibleLeafValues: []
        };
        parent.children.push(branch);
        branchByPath.set(branchId, branch);
      }
      parent = branch;
    }
    parent.children.push({
      kind: "leaf",
      id: option.value,
      value: option.value,
      label: option.label,
      segment: path[path.length - 1],
      path,
      allLeafValues: [option.value],
      visibleLeafValues: [option.value]
    });
  }

  function attachLeafValues(node: BenchmarkKeyTreeNode): string[] {
    if (node.kind === "leaf") return node.allLeafValues;
    node.allLeafValues = uniqueValues(node.children.flatMap((child) => attachLeafValues(child)));
    node.visibleLeafValues = node.allLeafValues;
    return node.allLeafValues;
  }

  for (const child of root.children) attachLeafValues(child);
  return root.children;
}

function filterTree(nodes: BenchmarkKeyTreeNode[], query: string): BenchmarkKeyTreeNode[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return nodes;

  function matchesLeaf(node: BenchmarkKeyLeafNode): boolean {
    const fullPath = node.path.join(" / ");
    return [fullPath, ...node.path, node.label]
      .map((entry) => normalizeText(entry))
      .some((entry) => entry.includes(normalizedQuery));
  }

  function visit(node: BenchmarkKeyTreeNode): BenchmarkKeyTreeNode | null {
    if (node.kind === "leaf") {
      if (!matchesLeaf(node)) return null;
      return { ...node, visibleLeafValues: [node.value] };
    }
    const children = node.children.map((child) => visit(child)).filter((child): child is BenchmarkKeyTreeNode => child !== null);
    if (!children.length) return null;
    return {
      ...node,
      children,
      visibleLeafValues: uniqueValues(children.flatMap((child) => child.visibleLeafValues))
    };
  }

  return nodes.map((node) => visit(node)).filter((node): node is BenchmarkKeyTreeNode => node !== null);
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

function BenchmarkKeyLeafItem(props: BenchmarkKeyNodeItemProps & { node: BenchmarkKeyLeafNode }) {
  const { node, parentMenu, selectedValueSet, toggleValues } = props;
  const state = selectionState(node.visibleLeafValues, selectedValueSet);
  return (
    <MenuItemCheckbox
      store={parentMenu}
      name="benchmark-key-selection"
      value={node.value}
      checked={state === "checked"}
      hideOnClick={false}
      className={menuItemRowClassName()}
      onClick={() => toggleValues(node.visibleLeafValues)}
    >
      <SelectionIndicator state={state} />
      <span className="truncate">{node.segment}</span>
    </MenuItemCheckbox>
  );
}

function BenchmarkKeyBranchItem(props: BenchmarkKeyNodeItemProps & { node: BenchmarkKeyBranchNode }) {
  const { node, parentMenu, selectedValueSet, toggleValues } = props;
  const submenu = useMenuStore({
    parent: parentMenu,
    combobox: null,
    placement: "right-start",
    showTimeout: 100
  });
  const state = selectionState(node.visibleLeafValues, selectedValueSet);

  return (
    <MenuProvider store={submenu}>
      <MenuButton
        store={submenu}
        showOnHover
        render={<MenuItem store={parentMenu} hideOnClick={false} focusOnHover blurOnHoverEnd={false} className={menuItemRowClassName({ align: "between" })} />}
        onClick={(event: MouseEvent<HTMLElement>) => {
          event.preventDefault();
          toggleValues(node.visibleLeafValues);
        }}
      >
        <SelectionIndicator state={state} />
        <span className="min-w-0 flex-1 truncate text-left">{node.segment}</span>
        <FiChevronRight className="shrink-0 text-gray-400" aria-hidden="true" />
      </MenuButton>
      <Menu store={submenu} portal overlap gutter={4} overflowPadding={8} fitViewport unmountOnHide className={Root_Menu_Classes}>
        {node.children.map((child) => (
          <BenchmarkKeyNodeItem
            key={child.id}
            node={child}
            parentMenu={submenu}
            selectedValueSet={selectedValueSet}
            toggleValues={toggleValues}
          />
        ))}
      </Menu>
    </MenuProvider>
  );
}

function BenchmarkKeyNodeItem(props: BenchmarkKeyNodeItemProps) {
  return props.node.kind === "leaf"
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
    stretchWidth = false
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
  const tree = useMemo(() => buildTree(options), [options]);
  const filteredTree = useMemo(() => filterTree(tree, searchValue), [searchValue, tree]);
  const selectedValueSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const orderedValues = useMemo(() => options.map((option) => option.value), [options]);
  const isDisabled = disabled || !options.length;
  const benchmarkKeyFilterWidth = useMemo(() => {
    const widestRootLabel = filteredTree.reduce((maxWidth, node) => {
      const label = node.kind === "leaf" ? node.label : node.segment;
      return Math.max(maxWidth, label.length);
    }, 0);
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
          aria-label="Search benchmark keys"
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
        aria-label="Benchmark keys"
      >
        {filteredTree.length ? (
          filteredTree.map((node) => (
            <BenchmarkKeyNodeItem
              key={node.id}
              node={node}
              parentMenu={menu}
              selectedValueSet={selectedValueSet}
              toggleValues={toggleValues}
            />
          ))
        ) : (
          <MenuEmptyState>No benchmark keys match your search.</MenuEmptyState>
        )}
      </Menu>
    </div>
  );
}
