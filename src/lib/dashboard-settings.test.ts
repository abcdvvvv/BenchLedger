import { afterEach, describe, expect, it, vi } from "vitest";
import { buildUISettingsURL, dateRangeEnd, dateRangeStart, defaultUISettings, persistedUISettings, readUISettings, settingsForDatabaseSource, UI_SETTINGS_STORAGE_KEY } from "./dashboard-settings";

function stubWindow(storedValue: string | null, search: string) { vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), localStorage: { getItem: (key: string) => key === UI_SETTINGS_STORAGE_KEY ? storedValue : null }, location: { search } }); }
afterEach(() => vi.unstubAllGlobals());

describe("dashboard settings", () => {
  it("restores persistent dimension selector rules while URL state only selects the active page", () => {
    stubWindow(JSON.stringify({ theme: "dark", varyingDimensionKeys: ["dimension-1", "dimension-2"], dimensionValueSelections: [{ dimensionKey: "d2", valueKeys: [] }] }), "?page=dimension-selector");
    expect(readUISettings()).toMatchObject({ activePage: "dimension-selector", theme: "dark", varyingDimensionKeys: ["dimension-1", "dimension-2"], dimensionValueSelections: [{ dimensionKey: "d2", valueKeys: [] }] });
  });

  it("restores the previous single varying-dimension setting", () => {
    stubWindow(JSON.stringify({ varyingDimensionKey: "dimension-1" }), ""); expect(readUISettings().varyingDimensionKeys).toEqual(["dimension-1"]);
  });

  it("serializes only page navigation into the URL", () => {
    expect(buildUISettingsURL({ ...defaultUISettings("light"), activePage: "dimension-selector" }, "https://example.test/app?embed=1#results")).toBe("/app?embed=1&page=dimension-selector#results");
  });

  it("persists dimension selector rules and excludes navigation", () => {
    const persisted = persistedUISettings({ ...defaultUISettings("dark"), activePage: "dimension-selector", selectedDatabaseId: "db-1", varyingDimensionKeys: ["dimension-1"] });
    expect(persisted).toMatchObject({ theme: "dark", selectedDatabaseId: "db-1", varyingDimensionKeys: ["dimension-1"] }); expect(persisted).not.toHaveProperty("activePage");
  });

  it("treats date-range inputs as UTC calendar boundaries", () => { expect(dateRangeStart("2026-01-02")).toBe(Date.parse("2026-01-02T00:00:00.000Z")); expect(dateRangeEnd("2026-01-02")).toBe(Date.parse("2026-01-02T23:59:59.999Z")); });

  it("resets database-specific fixed values when the database source changes while preserving the varying dimension", () => {
    const reset = settingsForDatabaseSource({ ...defaultUISettings("dark"), activePage: "trend-board", varyingDimensionKeys: ["dimension-1"], dimensionValueSelections: [{ dimensionKey: "d2", valueKeys: ["a", "b"] }], selectedBenchmarkKeys: ["old-benchmark"], focusPointKey: "old-point", trendLineShape: "line", trendBoardColumns: 5 }, "db-2");
    expect(reset).toMatchObject({ activePage: "trend-board", selectedDatabaseId: "db-2", varyingDimensionKeys: ["dimension-1"], dimensionValueSelections: [], selectedBenchmarkKeys: [], focusPointKey: "", trendLineShape: "line", trendBoardColumns: 5 });
  });
});
