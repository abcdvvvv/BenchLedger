import { Suspense, useEffect, useState } from "react";
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

  function pageHidden(page: ActivePage) {
    return page !== app.activePage;
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
            <div hidden={pageHidden("overview")}>
              <OverviewFeature state={app.datasetState} onOpenLocalFilePicker={app.openLocalFilePicker} />
            </div>
          ) : null}
          {shouldMount("trend-board") ? (
            <div hidden={pageHidden("trend-board")}>
              <TrendBoardFeature state={app.datasetState} />
            </div>
          ) : null}
          {shouldMount("benchmark-keys") ? (
            <div hidden={pageHidden("benchmark-keys")}>
              <BenchmarkKeysPage {...app.pages.benchmarkKeys} />
            </div>
          ) : null}
          {shouldMount("settings") ? (
            <div hidden={pageHidden("settings")}>
              <SettingsPage {...app.pages.settings} />
            </div>
          ) : null}
          {shouldMount("about") ? (
            <div hidden={pageHidden("about")}>
              <AboutPage {...app.pages.about} />
            </div>
          ) : null}
          {shouldMount("database-catalog") ? (
            <div hidden={pageHidden("database-catalog")}>
              <DatabasesPage {...app.pages.databases} />
            </div>
          ) : null}
        </Suspense>
      </AppLayout>
    </>
  );
}

export default App;
