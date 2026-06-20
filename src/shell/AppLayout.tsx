import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FiMenu, FiX } from "react-icons/fi";
import { cn } from "../components/ui/cn";
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
    drawerOpen: boolean;
    closeDrawer: () => void;
  }) => ReactNode;
  children: ReactNode;
  navigationKey: string;
  mobileTitle?: string;
};

export function AppLayout(props: AppLayoutProps) {
  const responsiveLayout = useMemo(
    () => (typeof window === "undefined" ? null : readResponsiveLayoutConfig()),
    []
  );
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    if (typeof window === "undefined") return "expanded";
    return resolveSidebarMode(window.innerWidth, readResponsiveLayoutConfig());
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    function handleResize() {
      setSidebarMode(resolveSidebarMode(window.innerWidth, responsiveLayout ?? readResponsiveLayoutConfig()));
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [responsiveLayout]);

  useEffect(() => {
    if (sidebarMode !== "drawer") {
      setDrawerOpen(false);
    }
  }, [sidebarMode]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [props.navigationKey]);

  useEffect(() => {
    if (!drawerOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen overflow-x-clip bg-stone-50 dark:bg-[#09090b]">
      {sidebarMode === "drawer" ? (
        <div className="pointer-events-none fixed inset-y-0 left-0 z-50">
          <div
            aria-hidden={!drawerOpen}
            style={{ width: drawerWidthValue() }}
            className={cn(
              "layout-sidebar-drawer pointer-events-auto h-full transition-all duration-200 ease-out",
              drawerOpen ? "visible translate-x-0" : "invisible -translate-x-full"
            )}
          >
            {props.renderSidebar({
              mode: "drawer",
              drawerOpen,
              closeDrawer: () => setDrawerOpen(false)
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
              drawerOpen: false,
              closeDrawer: () => setDrawerOpen(false)
            })}
          </div>
        )}

        <main className="min-w-0">
          {sidebarMode === "drawer" ? (
            <header className="layout-drawer-header">
              <IconButton
                onClick={() => setDrawerOpen((current) => !current)}
                label={drawerOpen ? "Close navigation" : "Open navigation"}
              >
                {drawerOpen ? <FiX className="size-5" aria-hidden="true" /> : <FiMenu className="size-5" aria-hidden="true" />}
              </IconButton>
              {props.mobileTitle ? <div className="type-card-title min-w-0 truncate">{props.mobileTitle}</div> : null}
            </header>
          ) : null}

          <div
            className="layout-page-shell"
            onClickCapture={() => {
              if (sidebarMode === "drawer" && drawerOpen) {
                setDrawerOpen(false);
              }
            }}
          >
            {props.children}
          </div>
        </main>
      </div>
    </div>
  );
}
