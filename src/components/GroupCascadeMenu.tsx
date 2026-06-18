import {
  Menu,
  MenuButton,
  MenuButtonArrow,
  MenuItem,
  MenuProvider
} from "@ariakit/react";
import { useMenuStore } from "@ariakit/react";
import { comparePath } from "../lib/dashboard";

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
  const menu = useMenuStore();

  return (
    <MenuProvider store={menu}>
      <MenuButton
        render={<MenuItem className="group-cascade-item group-cascade-item-parent" />}
        onClick={() => onSelect(node.value)}
      >
        <span className="group-cascade-item-label">{node.segment}</span>
        <MenuButtonArrow className="group-cascade-item-arrow" />
      </MenuButton>
      <Menu store={menu} gutter={4} shift={-8} unmountOnHide className="group-cascade-menu group-cascade-submenu">
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
            <MenuItem
              key={node.value}
              className="group-cascade-item"
              onClick={() => onSelect(node.value)}
            >
              {node.segment}
            </MenuItem>
          );
        }

        return (
          <GroupCascadeBranch key={node.value} node={node} onSelect={onSelect} />
        );
      })}
    </>
  );
}

export function GroupCascadeMenu(props: GroupCascadeMenuProps) {
  const { disabled, options, selectedLabel, onSelect } = props;
  const roots = buildGroupMenuTree(options);

  return (
    <MenuProvider>
      <MenuButton className="group-cascade-trigger" disabled={disabled}>
        <strong className="group-cascade-trigger-label">{selectedLabel}</strong>
        <span aria-hidden="true">▾</span>
      </MenuButton>
      <Menu gutter={-1} sameWidth unmountOnHide className="group-cascade-menu group-cascade-root-menu">
        <MenuItem className="group-cascade-item" onClick={() => onSelect("all")}>
          All groups
        </MenuItem>
        <GroupCascadeItems nodes={roots} onSelect={onSelect} />
      </Menu>
    </MenuProvider>
  );
}
