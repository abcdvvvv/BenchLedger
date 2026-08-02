import { Suspense, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AboutPage,
  BenchmarkKeysPage,
  CompareFeature,
  DatabasesPage,
  OverviewFeature,
  SettingsPage,
  TrendBoardFeature
} from "./app/pageRegistry";
import packageJson from "../package.json";
import { useBenchmarkDatasetState } from "./app/useBenchmarkDatasetState";
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
      window.dispatchEvent(new Event("resize"));
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

const Page_Render_Order: ActivePage[] = [
  "overview",
  "trend-board",
  "compare",
  "benchmark-keys",
  "settings",
  "about",
  "database-catalog"
];

function App() {
  const state = useBenchmarkDatasetState();
  const { settings, setSetting } = state;
  const activePage = settings.activePage;
  const [pageCache, setPageCache] = useState<{ sourceRevision: number; visitedPages: Set<ActivePage> }>(() => ({
    sourceRevision: state.datasetSourceRevision,
    visitedPages: new Set([activePage])
  }));
  const visitedPages = pageCache.sourceRevision === state.datasetSourceRevision
    ? pageCache.visitedPages
    : new Set<ActivePage>([activePage]);

  useEffect(() => {
    setPageCache((current) => {
      if (current.sourceRevision !== state.datasetSourceRevision) {
        return { sourceRevision: state.datasetSourceRevision, visitedPages: new Set([activePage]) };
      }
      if (current.visitedPages.has(activePage)) return current;
      return { ...current, visitedPages: new Set(current.visitedPages).add(activePage) };
    });
  }, [activePage, state.datasetSourceRevision]);

  if (state.phase === "booting" || state.phase === "loading-database") {
    return <LoadingState phase={state.phase} />;
  }

  const openLocalFilePicker = () => state.fileInputRef.current?.click();
  const pages: Record<ActivePage, ReactNode> = {
    overview: <OverviewFeature state={state} onOpenLocalFilePicker={openLocalFilePicker} />,
    "trend-board": <TrendBoardFeature state={state} />,
    compare: <CompareFeature state={state} />,
    "benchmark-keys": <BenchmarkKeysPage benchmarks={state.benchmarkDefinitions} />,
    "database-catalog": <DatabasesPage databaseCatalog={state.databaseCatalog} onOpenLocalFilePicker={openLocalFilePicker} />,
    settings: (
      <SettingsPage
        trendLineShape={settings.trendLineShape}
        trendMarkerSymbol={settings.trendMarkerSymbol}
        trendMarkerFillMode={settings.trendMarkerFillMode}
        onTrendLineShapeChange={(value) => setSetting("trendLineShape", value)}
        onTrendMarkerSymbolChange={(value) => setSetting("trendMarkerSymbol", value)}
        onTrendMarkerFillModeChange={(value) => setSetting("trendMarkerFillMode", value)}
      />
    ),
    about: <AboutPage applicationName="BenchLedger" version={packageJson.version} repositoryUrl="https://github.com/abcdvvvv/BenchLedger" />
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
            dataset={state.dataset}
            currentMetadata={state.currentMetadata}
            theme={settings.theme}
            onThemeToggle={() => setSetting("theme", settings.theme === "dark" ? "light" : "dark")}
            latestRun={state.latestRun}
            assetBaseUrl={Asset_Base_URL}
            siteTitle={state.siteTitle}
            onRequestClose={closeDrawer}
          />
        )}
      >
        <Suspense key={state.datasetSourceRevision} fallback={<PageLoadingState />}>
          {Page_Render_Order.map((id) => (
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
