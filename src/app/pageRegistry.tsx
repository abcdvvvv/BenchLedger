import { lazy } from "react";
import {
  FiBarChart2,
  FiDatabase,
  FiInfo,
  FiLayers,
  FiSettings,
  FiTrendingUp
} from "react-icons/fi";
import type { IconType } from "react-icons";
import type { ActivePage } from "../lib/dashboard-settings";

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
  { id: "settings", navigationLabel: "Settings", Icon: FiSettings },
  { id: "about", navigationLabel: "About", Icon: FiInfo }
];

export const OverviewFeature = lazy(async () => {
  const module = await import("../features/overview/OverviewFeature");
  return { default: module.OverviewFeature };
});

export const TrendBoardFeature = lazy(async () => {
  const module = await import("../features/trend-board/TrendBoardFeature");
  return { default: module.TrendBoardFeature };
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

export const AboutPage = lazy(async () => {
  const module = await import("../features/about/AboutPage");
  return { default: module.AboutPage };
});
