import type { RefObject, ChangeEvent } from "react";
import type { AppSidebarProps } from "../shell/AppSidebar";
import type { ActivePage } from "../lib/dashboard";
import type { OverviewPageProps } from "../features/overview/OverviewPage";
import type { TrendBoardPageProps } from "../features/trend-board/TrendBoardPage";
import type { BenchmarkKeysPageProps } from "../features/benchmark-keys/BenchmarkKeysPage";
import type { SettingsPageProps } from "../features/settings/SettingsPage";
import type { DatabasesPageProps } from "../features/databases/DatabasesPage";
import type { useBenchmarkDataSource } from "../lib/useBenchmarkDataSource";

export type BenchLedgerAppPages = {
  overview: OverviewPageProps;
  trendBoard: TrendBoardPageProps;
  benchmarkKeys: BenchmarkKeysPageProps;
  settings: SettingsPageProps;
  databases: DatabasesPageProps;
};

export type BenchLedgerAppModel = {
  activePage: ActivePage;
  phase: ReturnType<typeof useBenchmarkDataSource>["phase"];
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleLocalFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  sidebarProps: Omit<AppSidebarProps, "mode" | "onRequestClose">;
  siteTitle: string;
  pages: BenchLedgerAppPages;
};
