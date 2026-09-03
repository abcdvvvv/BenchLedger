import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BenchmarkDatabaseState } from "../../app/useBenchmarkDatabaseState";
import type { DimensionDefinition } from "../../lib/dimension-selector";
import { DimensionSelectorPage } from "./DimensionSelectorPage";

const Kind: DimensionDefinition = { key: "kind", category: "code", pathId: '["source","kind"]', label: "Code / Source / Kind", path: ["source", "kind"] };
const Revision: DimensionDefinition = { key: "revision", category: "code", pathId: '["source","revision"]', label: "Code / Source / Revision", path: ["source", "revision"] };

function state(): BenchmarkDatabaseState {
  return { settings: { varyingDimensionKeys: [Revision.key], dimensionValueSelections: [{ dimensionKey: Kind.key, valueKeys: ["git"] }] }, setSetting: () => undefined, dimensionSelection: { dimensions: [Kind, Revision], varyingDimensionKeys: [Revision.key], fixedValueSelections: [{ dimension: Kind, valueKeys: ["git"], options: [{ key: "git", label: "git", configurationCount: 2 }] }], validation: { isValid: true, varyingCount: 1, issues: [] } } } as unknown as BenchmarkDatabaseState;
}

describe("Dimension Selector hierarchy", () => {
  it("row-spans adjacent shared dimension ancestors instead of repeating them", () => {
    const html = renderToStaticMarkup(<DimensionSelectorPage state={state()} />);
    expect((html.match(/>Code</g) ?? []).length).toBe(1); expect((html.match(/>Source</g) ?? []).length).toBe(1); expect(html).toContain("rowSpan=\"2\""); expect(html).toContain(">Kind<"); expect(html).toContain(">Revision<");
  });
  it("shows up to four selected values, summarizes larger selections, and disables a single-value selector", () => {
    const base = state();
    const four: DimensionDefinition = { key: "four", category: "hardware", pathId: '["cpu","model"]', label: "Hardware / CPU / Model", path: ["cpu", "model"] };
    const five: DimensionDefinition = { key: "five", category: "software", pathId: '["runtime","version"]', label: "Software / Runtime / Version", path: ["runtime", "version"] };
    const fourOptions = ["A", "B", "C", "D"].map((label) => ({ key: label.toLowerCase(), label, configurationCount: 1 }));
    const fiveOptions = ["A", "B", "C", "D", "E"].map((label) => ({ key: label.toLowerCase(), label, configurationCount: 1 }));
    base.dimensionSelection.dimensions = [Kind, four, five, Revision];
    base.dimensionSelection.fixedValueSelections = [{ dimension: Kind, valueKeys: ["git"], options: [{ key: "git", label: "git", configurationCount: 2 }] }, { dimension: four, valueKeys: fourOptions.map((option) => option.key), options: fourOptions }, { dimension: five, valueKeys: fiveOptions.map((option) => option.key), options: fiveOptions }];
    const html = renderToStaticMarkup(<DimensionSelectorPage state={base} />);
    expect(html).toContain("A, B, C, D"); expect(html).toContain("5 values selected"); expect(html).toContain("Only one value is available, so this selection cannot be changed."); expect(html).toContain("disabled=");
  });

});
