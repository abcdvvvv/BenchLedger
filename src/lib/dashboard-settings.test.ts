import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildUISettingsURL,
  defaultUISettings,
  persistedUISettings,
  readUISettings,
  settingsForDatasetSource,
  UI_SETTINGS_STORAGE_KEY
} from "./dashboard-settings";

function stubWindow(storedValue: string | null, search: string) {
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: false }),
    localStorage: { getItem: (key: string) => key === UI_SETTINGS_STORAGE_KEY ? storedValue : null },
    location: { search }
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("dashboard settings", () => {
  it("uses URL navigation and Compare state while restoring stored display preferences", () => {
    stubWindow(JSON.stringify({
      activePage: "settings",
      theme: "dark",
      compareBaselineConfigurationKey: "stale-baseline"
    }), "?page=compare&compareBaseline=configuration-1&compareCategory=hardware" +
      "&compareField=cpu.model&compareBenchmark=benchmark-1&compareMetric=time%3Amedian");

    expect(readUISettings()).toMatchObject({
      activePage: "compare",
      theme: "dark",
      compareBaselineConfigurationKey: "configuration-1",
      compareVariableCategory: "hardware",
      compareVariableFieldPathIds: ["cpu.model"],
      compareBenchmarkKey: "benchmark-1",
      compareMetricKey: "time:median"
    });
  });

  it("serializes page and Compare state without losing unrelated URL data", () => {
    const compareSettings = {
      ...defaultUISettings("light"),
      activePage: "compare" as const,
      compareBaselineConfigurationKey: "configuration-1",
      compareVariableCategory: "hardware" as const,
      compareVariableFieldPathIds: ["cpu.model", "cpu.model", "memory.total"],
      compareBenchmarkKey: "benchmark-1",
      compareMetricKey: "time:median"
    };
    const compareURL = buildUISettingsURL(compareSettings, "https://example.test/app?embed=1#results");
    expect(compareURL).toBe(
      "/app?embed=1&page=compare&compareBaseline=configuration-1&compareCategory=hardware" +
      "&compareField=cpu.model&compareField=memory.total&compareBenchmark=benchmark-1&compareMetric=time%3Amedian#results"
    );
    expect(buildUISettingsURL(
      { ...compareSettings, activePage: "benchmark-keys" },
      `https://example.test${compareURL}`
    )).toBe("/app?embed=1&page=benchmark-keys#results");
  });

  it("does not persist URL-owned navigation and Compare state", () => {
    const persisted = persistedUISettings({
      ...defaultUISettings("dark"),
      activePage: "compare",
      selectedDatabaseId: "db-1",
      compareBaselineConfigurationKey: "configuration-1",
      compareVariableCategory: "code",
      compareVariableFieldPathIds: ["source.revision"],
      compareBenchmarkKey: "benchmark-1",
      compareMetricKey: "time:median"
    });

    expect(persisted).toMatchObject({ theme: "dark", selectedDatabaseId: "db-1" });
    expect(persisted).not.toHaveProperty("activePage");
    expect(persisted).not.toHaveProperty("compareBaselineConfigurationKey");
  });

  it("resets only dataset-scoped state when the source changes", () => {
    const reset = settingsForDatasetSource({
      ...defaultUISettings("dark"),
      activePage: "trend-board",
      environmentPair: "old-pair",
      focusRunId: "old-run",
      trendBoardSelectedBenchmarkKeys: ["old-benchmark"],
      compareBaselineConfigurationKey: "old-configuration",
      trendLineShape: "line",
      trendBoardColumns: 5
    }, "db-2");

    expect(reset).toMatchObject({
      activePage: "trend-board",
      theme: "dark",
      selectedDatabaseId: "db-2",
      environmentPair: "all",
      focusRunId: "",
      trendBoardSelectedBenchmarkKeys: [],
      compareBaselineConfigurationKey: "",
      trendLineShape: "line",
      trendBoardColumns: 5
    });
  });
});
