import {
  Menu,
  MenuButton,
  MenuButtonArrow,
  MenuItem,
  MenuProvider,
  useMenuStore
} from "@ariakit/react";
import { comparePath } from "../../../lib/dashboard";
import { cn } from "../../../components/ui/cn";
import { DisclosureTriggerContent, menuItemRowClassName, menuSurfaceClassName, menuTriggerClassName } from "../../../components/ui/Menu";

export type GroupMenuOption = {
  value: string;
  path: string[];
};

type GroupMenuNode = {
  segment: string;
  value: string;
  path: string[];
  children: GroupMenuNode[];
};

function buildGroupMenuTree(options: GroupMenuOption[]): GroupMenuNode[] {
  const roots: GroupMenuNode[] = [];
  const nodeByValue = new Map<string, GroupMenuNode>();

  for (const option of options) {
    const parentPath = option.path.slice(0, -1);
    const parentValue = parentPath.length ? JSON.stringify(parentPath) : "";
    const node: GroupMenuNode = {
      segment: option.path[option.path.length - 1],
      value: option.value,
      path: option.path,
      children: []
    };
    nodeByValue.set(option.value, node);
    if (!parentValue) {
      roots.push(node);
      continue;
    }
    const parentNode = nodeByValue.get(parentValue);
    if (parentNode) parentNode.children.push(node);
  }

  function sortNodes(nodes: GroupMenuNode[]) {
    nodes.sort((left, right) => comparePath(left.path, right.path));
    for (const node of nodes) sortNodes(node.children);
  }

  sortNodes(roots);
  return roots;
}

type GroupCascadeMenuProps = {
  disabled: boolean;
  options: GroupMenuOption[];
  selectedValue: string;
  selectedLabel: string;
  onSelect: (value: string) => void;
};

type GroupCascadeItemsProps = {
  nodes: GroupMenuNode[];
  onSelect: (value: string) => void;
};

type GroupCascadeBranchProps = {
  node: GroupMenuNode;
  onSelect: (value: string) => void;
};

function GroupCascadeBranch(props: GroupCascadeBranchProps) {
  const { node, onSelect } = props;
  const menu = useMenuStore({ placement: "right-start", showTimeout: 100 });

  return (
    <MenuProvider store={menu}>
      <MenuButton
        render={<MenuItem className={menuItemRowClassName({ align: "between" })} />}
        onClick={() => onSelect(node.value)}
      >
        <span className="truncate">{node.segment}</span>
        <MenuButtonArrow className="shrink-0 text-gray-400" />
      </MenuButton>
      <Menu
        store={menu}
        portal
        overlap
        gutter={4}
        shift={-8}
        fitViewport
        overflowPadding={8}
        unmountOnHide
        className={menuSurfaceClassName("max-h-80 overflow-auto")}
      >
        <GroupCascadeItems nodes={node.children} onSelect={onSelect} />
      </Menu>
    </MenuProvider>
  );
}

function GroupCascadeItems(props: GroupCascadeItemsProps) {
  const { nodes, onSelect } = props;
  return (
    <>
      {nodes.map((node) => {
        if (!node.children.length) {
          return (
            <MenuItem key={node.value} className={menuItemRowClassName()} onClick={() => onSelect(node.value)}>
              {node.segment}
            </MenuItem>
          );
        }
        return <GroupCascadeBranch key={node.value} node={node} onSelect={onSelect} />;
      })}
    </>
  );
}

export function GroupCascadeMenu(props: GroupCascadeMenuProps) {
  const { disabled, options, selectedLabel, onSelect } = props;
  const roots = buildGroupMenuTree(options);

  return (
      <MenuProvider>
      <MenuButton className={cn(menuTriggerClassName({ disabled }))} disabled={disabled}>
        <DisclosureTriggerContent>{selectedLabel}</DisclosureTriggerContent>
      </MenuButton>
      <Menu gutter={0} sameWidth unmountOnHide className={menuSurfaceClassName("max-h-80 overflow-auto")}>
        <MenuItem className={menuItemRowClassName()} onClick={() => onSelect("all")}>All groups</MenuItem>
        <GroupCascadeItems nodes={roots} onSelect={onSelect} />
      </Menu>
    </MenuProvider>
  );
}
