import type { RefObject, ChangeEvent } from "react";
import type { AppSidebarProps } from "../shell/AppSidebar";
import type { ActivePage } from "../lib/dashboard-settings";
import type { BenchmarkKeysPageProps } from "../features/benchmark-keys/BenchmarkKeysPage";
import type { SettingsPageProps } from "../features/settings/SettingsPage";
import type { DatabasesPageProps } from "../features/databases/DatabasesPage";
import type { AboutPageProps } from "../features/about/AboutPage";
import type { useBenchmarkDataSource } from "../lib/useBenchmarkDataSource";
import type { BenchmarkDatasetState } from "./useBenchmarkDatasetState";

export type BenchLedgerAppPages = {
  benchmarkKeys: BenchmarkKeysPageProps;
  settings: SettingsPageProps;
  databases: DatabasesPageProps;
  about: AboutPageProps;
};

export type BenchLedgerAppModel = {
  activePage: ActivePage;
  phase: ReturnType<typeof useBenchmarkDataSource>["phase"];
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleLocalFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  openLocalFilePicker: () => void;
  sidebarProps: Omit<AppSidebarProps, "mode" | "onRequestClose">;
  siteTitle: string;
  datasetState: BenchmarkDatasetState;
  pages: BenchLedgerAppPages;
};
