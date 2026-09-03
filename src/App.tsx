import { Suspense, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AboutPage,
  BenchmarkKeysPage,
  DimensionSelectorPage,
  DatabasesPage,
  OverviewPage,
  SettingsPage,
  TrendBoardPage,
  App_Page_Definitions
} from "./app/pageRegistry";
import { useBenchmarkDatabaseState } from "./app/useBenchmarkDatabaseState";
import { Asset_Base_URL } from "./lib/dashboard-data";
import type { ActivePage } from "./lib/dashboard-settings";
import { AppSidebar } from "./shell/AppSidebar";
import { AppLayout } from "./shell/AppLayout";

function PageSlot(props: { active: boolean; children: ReactNode }) {
  const slotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!props.active) return;
    const frame = window.requestAnimationFrame(() => {
      slotRef.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [props.active]);

  return (
    <div
      ref={slotRef}
      aria-hidden={!props.active}
      inert={!props.active}
      className={props.active ? "layout-page-slot layout-page-slot-active" : "layout-page-slot layout-page-slot-inactive"}
    >
      {props.children}
    </div>
  );
}

function PageLoadingState() {
  return (
    <div role="status" aria-live="polite" className="surface-empty pad-empty type-body-muted grid min-h-[16rem] place-items-center">
      Loading page…
    </div>
  );
}

function LoadingState(props: { phase: "booting" | "loading-database" }) {
  return (
    <div role="status" aria-live="polite" className="grid min-h-screen place-items-center px-6 text-center type-body-muted">
      {props.phase === "booting" ? "Discovering benchmark sources..." : "Loading benchmark database..."}
    </div>
  );
}

function App() {
  const state = useBenchmarkDatabaseState();
  const { settings, setSetting } = state;
  const activePage = settings.activePage;
  // Visited pages intentionally stay mounted for the lifetime of the current database source. This is a deliberate latency tradeoff:
  // keeping their Plotly state and derived UI state resident makes repeated page switches effectively immediate. Do not evict inactive pages for memory alone.
  const [pageCache, setPageCache] = useState<{ sourceRevision: number; visitedPages: Set<ActivePage> }>(() => ({
    sourceRevision: state.databaseSourceRevision,
    visitedPages: new Set([activePage])
  }));
  const visitedPages = pageCache.sourceRevision === state.databaseSourceRevision
    ? pageCache.visitedPages
    : new Set<ActivePage>([activePage]);

  useEffect(() => {
    setPageCache((current) => {
      if (current.sourceRevision !== state.databaseSourceRevision) {
        return { sourceRevision: state.databaseSourceRevision, visitedPages: new Set([activePage]) };
      }
      if (current.visitedPages.has(activePage)) return current;
      return { ...current, visitedPages: new Set(current.visitedPages).add(activePage) };
    });
  }, [activePage, state.databaseSourceRevision]);

  if (state.phase === "booting" || state.phase === "loading-database") {
    return <LoadingState phase={state.phase} />;
  }

  const openLocalFilePicker = () => state.fileInputRef.current?.click();
  const pages: Record<ActivePage, ReactNode> = {
    overview: <OverviewPage state={state} onOpenLocalFilePicker={openLocalFilePicker} />,
    "trend-board": <TrendBoardPage state={state} />,
    "dimension-selector": <DimensionSelectorPage state={state} />,
    "benchmark-keys": <BenchmarkKeysPage benchmarks={state.benchmarkDefinitions} />,
    "database-catalog": <DatabasesPage databaseCatalog={state.databaseCatalog} onOpenLocalFilePicker={openLocalFilePicker} />,
    settings: (
      <SettingsPage
        theme={settings.theme}
        trendLineShape={settings.trendLineShape}
        trendMarkerSymbol={settings.trendMarkerSymbol}
        trendMarkerFillMode={settings.trendMarkerFillMode}
        onThemeChange={(value) => setSetting("theme", value)}
        onTrendLineShapeChange={(value) => setSetting("trendLineShape", value)}
        onTrendMarkerSymbolChange={(value) => setSetting("trendMarkerSymbol", value)}
        onTrendMarkerFillModeChange={(value) => setSetting("trendMarkerFillMode", value)}
      />
    ),
    about: <AboutPage applicationName="BenchLedger" version={__BENCHLEDGER_VERSION__} repositoryUrl="https://github.com/abcdvvvv/BenchLedger" />
  };

  return (
    <>
      <input
        ref={state.fileInputRef}
        type="file"
        accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3"
        hidden
        onChange={(event: ChangeEvent<HTMLInputElement>) => void state.handleLocalFileChange(event)}
      />

      <AppLayout
        navigationKey={activePage}
        mobileTitle={state.siteTitle}
        renderSidebar={({ mode, closeDrawer }) => (
          <AppSidebar
            mode={mode}
            activePage={activePage}
            onPageChange={state.navigateToPage}
            sourceDatabases={state.sourceDatabases}
            selectedDatabaseId={settings.selectedDatabaseId}
            onDatabaseChange={state.handleDatabaseSelection}
            database={state.database}
            theme={settings.theme}
            assetBaseUrl={Asset_Base_URL}
            siteTitle={state.siteTitle}
            onRequestClose={closeDrawer}
          />
        )}
      >
        <Suspense key={state.databaseSourceRevision} fallback={<PageLoadingState />}>
          {App_Page_Definitions.map(({ id }) => (
            id === activePage || visitedPages.has(id)
              ? <PageSlot key={id} active={activePage === id}>{pages[id]}</PageSlot>
              : null
          ))}
        </Suspense>
      </AppLayout>
    </>
  );
}

export default App;
