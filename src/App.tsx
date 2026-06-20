import { Suspense } from "react";
import { DatabasesPage, BenchmarkKeysPage, OverviewPage, SettingsPage, TrendBoardPage } from "./app/pageRegistry";
import { useBenchLedgerAppModel } from "./app/useBenchLedgerAppModel";
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

  if (app.phase === "booting" || app.phase === "loading-database") {
    return <LoadingState phase={app.phase} />;
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
          {app.activePage === "overview" ? (
            <OverviewPage {...app.pages.overview} />
          ) : app.activePage === "trend-board" ? (
            <TrendBoardPage {...app.pages.trendBoard} />
          ) : app.activePage === "benchmark-keys" ? (
            <BenchmarkKeysPage {...app.pages.benchmarkKeys} />
          ) : app.activePage === "settings" ? (
            <SettingsPage {...app.pages.settings} />
          ) : (
            <DatabasesPage {...app.pages.databases} />
          )}
        </Suspense>
      </AppLayout>
    </>
  );
}

export default App;
