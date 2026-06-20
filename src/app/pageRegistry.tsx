import { lazy } from "react";
import {
  FiBarChart2,
  FiDatabase,
  FiLayers,
  FiSettings,
  FiTrendingUp
} from "react-icons/fi";
import type { IconType } from "react-icons";
import type { ActivePage } from "../lib/dashboard";

export type AppPageDefinition = {
  id: ActivePage;
  navigationLabel: string;
  Icon: IconType;
};

export const App_Page_Definitions: AppPageDefinition[] = [
  { id: "overview", navigationLabel: "Dashboard", Icon: FiBarChart2 },
  { id: "trend-board", navigationLabel: "Trend Board", Icon: FiTrendingUp },
  { id: "benchmark-keys", navigationLabel: "Benchmark Keys", Icon: FiLayers },
  { id: "database-catalog", navigationLabel: "Databases", Icon: FiDatabase },
  { id: "settings", navigationLabel: "Settings", Icon: FiSettings }
];

export const OverviewPage = lazy(async () => {
  const module = await import("../features/overview/OverviewPage");
  return { default: module.OverviewPage };
});

export const TrendBoardPage = lazy(async () => {
  const module = await import("../features/trend-board/TrendBoardPage");
  return { default: module.TrendBoardPage };
});

export const BenchmarkKeysPage = lazy(async () => {
  const module = await import("../features/benchmark-keys/BenchmarkKeysPage");
  return { default: module.BenchmarkKeysPage };
});

export const SettingsPage = lazy(async () => {
  const module = await import("../features/settings/SettingsPage");
  return { default: module.SettingsPage };
});

export const DatabasesPage = lazy(async () => {
  const module = await import("../features/databases/DatabasesPage");
  return { default: module.DatabasesPage };
});
