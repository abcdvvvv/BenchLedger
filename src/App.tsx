import { Suspense, useEffect, useState, type ReactNode } from "react";
import {
  AboutPage,
  BenchmarkKeysPage,
  DatabasesPage,
  OverviewFeature,
  SettingsPage,
  TrendBoardFeature
} from "./app/pageRegistry";
import { useBenchLedgerAppModel } from "./app/useBenchLedgerAppModel";
import type { ActivePage } from "./lib/dashboard-settings";
import { AppSidebar } from "./shell/AppSidebar";
import { AppLayout } from "./shell/AppLayout";

function PageSlot(props: { active: boolean; children: ReactNode }) {
  return (
    <div
      aria-hidden={!props.active}
      className={props.active ? "layout-page-slot layout-page-slot-active" : "layout-page-slot layout-page-slot-inactive"}
    >
      {props.children}
    </div>
  );
}

function PageLoadingState() {
  return (
    <div className="surface-empty pad-empty type-body-muted grid min-h-[16rem] place-items-center">
      Loading page…
    </div>
  );
}

function LoadingState(props: { phase: "booting" | "loading-database" }) {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center type-body-muted">
      {props.phase === "booting" ? "Discovering benchmark sources..." : "Loading benchmark database..."}
    </div>
  );
}

function App() {
  const app = useBenchLedgerAppModel();
  const [visitedPages, setVisitedPages] = useState<Set<ActivePage>>(() => new Set([app.activePage]));

  useEffect(() => {
    setVisitedPages((current) => {
      if (current.has(app.activePage)) return current;
      const next = new Set(current);
      next.add(app.activePage);
      return next;
    });
  }, [app.activePage]);

  if (app.phase === "booting" || app.phase === "loading-database") {
    return <LoadingState phase={app.phase} />;
  }

  function shouldMount(page: ActivePage) {
    return page === app.activePage || visitedPages.has(page);
  }

  return (
    <>
      <input
        ref={app.fileInputRef}
        type="file"
        accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3"
        className="visually-hidden"
        onChange={(event) => {
          void app.handleLocalFileChange(event);
        }}
      />

      <AppLayout
        navigationKey={app.activePage}
        mobileTitle={app.siteTitle}
        renderSidebar={({ mode, closeDrawer }) => (
          <AppSidebar
            {...app.sidebarProps}
            mode={mode}
            onRequestClose={closeDrawer}
          />
        )}
      >
        <Suspense fallback={<PageLoadingState />}>
          {shouldMount("overview") ? (
            <PageSlot active={app.activePage === "overview"}>
              <OverviewFeature state={app.datasetState} onOpenLocalFilePicker={app.openLocalFilePicker} />
            </PageSlot>
          ) : null}
          {shouldMount("trend-board") ? (
            <PageSlot active={app.activePage === "trend-board"}>
              <TrendBoardFeature state={app.datasetState} />
            </PageSlot>
          ) : null}
          {shouldMount("benchmark-keys") ? (
            <PageSlot active={app.activePage === "benchmark-keys"}>
              <BenchmarkKeysPage {...app.pages.benchmarkKeys} />
            </PageSlot>
          ) : null}
          {shouldMount("settings") ? (
            <PageSlot active={app.activePage === "settings"}>
              <SettingsPage {...app.pages.settings} />
            </PageSlot>
          ) : null}
          {shouldMount("about") ? (
            <PageSlot active={app.activePage === "about"}>
              <AboutPage {...app.pages.about} />
            </PageSlot>
          ) : null}
          {shouldMount("database-catalog") ? (
            <PageSlot active={app.activePage === "database-catalog"}>
              <DatabasesPage {...app.pages.databases} />
            </PageSlot>
          ) : null}
        </Suspense>
      </AppLayout>
    </>
  );
}

export default App;
