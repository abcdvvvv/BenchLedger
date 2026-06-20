export type SidebarMode = "expanded" | "icon" | "drawer";

type ResponsiveLayoutConfig = {
  sidebarIconMinWidth: number;
  sidebarExpandedMinWidth: number;
};

const Layout_CSS_Vars = {
  sidebarIconMinWidth: "--breakpoint-sidebar-icon",
  sidebarExpandedMinWidth: "--breakpoint-sidebar-expanded",
  sidebarExpandedWidth: "--layout-sidebar-width-expanded",
  sidebarIconWidth: "--layout-sidebar-width-icon",
  sidebarDrawerWidth: "--layout-sidebar-width-drawer"
} as const;

const Layout_Fallbacks = {
  sidebarIconMinWidth: 720,
  sidebarExpandedMinWidth: 1280
} as const;

function readPxCssVar(name: string, fallback: number): number {
  const rawValue = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parsedValue = Number.parseFloat(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export function readResponsiveLayoutConfig(): ResponsiveLayoutConfig {
  return {
    sidebarIconMinWidth: readPxCssVar(Layout_CSS_Vars.sidebarIconMinWidth, Layout_Fallbacks.sidebarIconMinWidth),
    sidebarExpandedMinWidth: readPxCssVar(Layout_CSS_Vars.sidebarExpandedMinWidth, Layout_Fallbacks.sidebarExpandedMinWidth)
  };
}

export function resolveSidebarMode(width: number, config: ResponsiveLayoutConfig): SidebarMode {
  if (width >= config.sidebarExpandedMinWidth) return "expanded";
  if (width >= config.sidebarIconMinWidth) return "icon";
  return "drawer";
}

export function layoutGridTemplateColumns(mode: SidebarMode): string {
  if (mode === "drawer") return "minmax(0, 1fr)";
  if (mode === "expanded") return `var(${Layout_CSS_Vars.sidebarExpandedWidth}) minmax(0, 1fr)`;
  return `var(${Layout_CSS_Vars.sidebarIconWidth}) minmax(0, 1fr)`;
}

export function drawerWidthValue(): string {
  return `var(${Layout_CSS_Vars.sidebarDrawerWidth})`;
}
