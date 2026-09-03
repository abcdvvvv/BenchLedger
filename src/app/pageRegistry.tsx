import { lazy, type ComponentType } from "react";
import {
  FiBarChart2,
  FiDatabase,
  FiInfo,
  FiLayers,
  FiSettings,
  FiTrendingUp
} from "react-icons/fi";
import type { IconType } from "react-icons";
import { TbCube } from "react-icons/tb";
import type { ActivePage } from "../lib/dashboard-settings";

type AppPageDefinition = {
  id: ActivePage;
  navigationLabel: string;
  Icon: IconType;
};

export const App_Page_Definitions: AppPageDefinition[] = [
  { id: "overview", navigationLabel: "Dashboard", Icon: FiBarChart2 },
  { id: "trend-board", navigationLabel: "Trend Board", Icon: FiTrendingUp },
  { id: "dimension-selector", navigationLabel: "Dimensions", Icon: TbCube },
  { id: "benchmark-keys", navigationLabel: "Benchmark Keys", Icon: FiLayers },
  { id: "database-catalog", navigationLabel: "Databases", Icon: FiDatabase },
  { id: "settings", navigationLabel: "Settings", Icon: FiSettings },
  { id: "about", navigationLabel: "About", Icon: FiInfo }
];

type PageProps<T> = T extends ComponentType<infer P> ? P : never;

function lazyPage<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(async () => ({
    default: (await load())[name] as ComponentType<PageProps<M[K]>>
  }));
}

export const OverviewPage = lazyPage(() => import("../features/overview/OverviewPage"), "OverviewPage");
export const TrendBoardPage = lazyPage(() => import("../features/trend-board/TrendBoardPage"), "TrendBoardPage");
export const BenchmarkKeysPage = lazyPage(() => import("../features/benchmark-keys/BenchmarkKeysPage"), "BenchmarkKeysPage");
export const SettingsPage = lazyPage(() => import("../features/settings/SettingsPage"), "SettingsPage");
export const DatabasesPage = lazyPage(() => import("../features/databases/DatabasesPage"), "DatabasesPage");
export const AboutPage = lazyPage(() => import("../features/about/AboutPage"), "AboutPage");
export const DimensionSelectorPage = lazyPage(() => import("../features/dimension-selector/DimensionSelectorPage"), "DimensionSelectorPage");
