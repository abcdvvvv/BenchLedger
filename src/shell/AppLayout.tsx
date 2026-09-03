import { useEffect, useRef, useState, type ReactNode } from "react";
import { FiMenu, FiX } from "react-icons/fi";
import { IconButton } from "../components/ui/IconButton";
import {
  drawerWidthValue,
  layoutGridTemplateColumns,
  readResponsiveLayoutConfig,
  resolveSidebarMode,
  type SidebarMode
} from "./layoutConfig";

type AppLayoutProps = {
  renderSidebar: (props: {
    mode: SidebarMode;
    closeDrawer: (restoreFocus?: boolean) => void;
  }) => ReactNode;
  children: ReactNode;
  navigationKey: string;
  mobileTitle?: string;
};

const Drawer_Id = "benchledger-navigation-drawer";
const Focusable_Selector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(Focusable_Selector)).filter(
    (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true"
  );
}

export function AppLayout(props: AppLayoutProps) {
  const [responsiveLayout] = useState(readResponsiveLayoutConfig);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() =>
    resolveSidebarMode(window.innerWidth, responsiveLayout)
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreDrawerFocusRef = useRef(true);

  function closeDrawer(restoreFocus = true) {
    restoreDrawerFocusRef.current = restoreFocus;
    setDrawerOpen(false);
  }

  useEffect(() => {
    const expandedQuery = window.matchMedia(`(min-width: ${responsiveLayout.sidebarExpandedMinWidth}px)`);
    const iconQuery = window.matchMedia(`(min-width: ${responsiveLayout.sidebarIconMinWidth}px)`);

    function syncSidebarMode() {
      setSidebarMode(expandedQuery.matches ? "expanded" : iconQuery.matches ? "icon" : "drawer");
    }

    syncSidebarMode();
    expandedQuery.addEventListener("change", syncSidebarMode);
    iconQuery.addEventListener("change", syncSidebarMode);
    return () => {
      expandedQuery.removeEventListener("change", syncSidebarMode);
      iconQuery.removeEventListener("change", syncSidebarMode);
    };
  }, [responsiveLayout]);

  useEffect(() => {
    restoreDrawerFocusRef.current = false;
    setDrawerOpen(false);
  }, [sidebarMode, props.navigationKey]);

  useEffect(() => {
    if (!drawerOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      const firstFocusable = drawerRef.current ? focusableElements(drawerRef.current)[0] : null;
      firstFocusable?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer(true);
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;

      const focusable = focusableElements(drawerRef.current);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (restoreDrawerFocusRef.current) {
        window.requestAnimationFrame(() => drawerTriggerRef.current?.focus());
      }
      restoreDrawerFocusRef.current = true;
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen overflow-x-clip bg-stone-50 dark:bg-[#09090b]">
      {sidebarMode === "drawer" && drawerOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
            onClick={() => closeDrawer(true)}
          />
          <div
            ref={drawerRef}
            id={Drawer_Id}
            role="dialog"
            aria-modal="true"
            aria-label="Primary navigation"
            style={{ width: drawerWidthValue() }}
            className="layout-sidebar-drawer relative h-full"
          >
            <div className="absolute right-3 top-3 z-10">
              <IconButton onClick={() => closeDrawer(true)} label="Close navigation">
                <FiX className="size-5" aria-hidden="true" />
              </IconButton>
            </div>
            {props.renderSidebar({
              mode: "drawer",
              closeDrawer
            })}
          </div>
        </div>
      ) : null}

      <div
        className="grid min-h-screen w-full"
        style={{
          gridTemplateColumns: layoutGridTemplateColumns(sidebarMode)
        }}
      >
        {sidebarMode === "drawer" ? null : (
          <div className="layout-sidebar-rail">
            {props.renderSidebar({
              mode: sidebarMode,
              closeDrawer
            })}
          </div>
        )}

        <main className="min-w-0">
          {sidebarMode === "drawer" ? (
            <header className="layout-drawer-header">
              <IconButton
                buttonRef={drawerTriggerRef}
                onClick={() => {
                  if (drawerOpen) closeDrawer(true);
                  else setDrawerOpen(true);
                }}
                label={drawerOpen ? "Close navigation" : "Open navigation"}
                aria-controls={Drawer_Id}
                aria-expanded={drawerOpen}
              >
                {drawerOpen ? <FiX className="size-5" aria-hidden="true" /> : <FiMenu className="size-5" aria-hidden="true" />}
              </IconButton>
              {props.mobileTitle ? <div className="type-card-title min-w-0 truncate">{props.mobileTitle}</div> : null}
            </header>
          ) : null}

          <div
            className="layout-page-shell"
            inert={sidebarMode === "drawer" && drawerOpen}
            aria-hidden={sidebarMode === "drawer" && drawerOpen}
          >
            {props.children}
          </div>
        </main>
      </div>
    </div>
  );
}
