import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BenchmarkRun } from "../../../lib/types";
import { DimensionPointSelectMenu } from "./DimensionPointSelectMenu";

const Point = { key: "revision", label: "abcdef1", configurationKeys: ["config"] };
function benchmarkRun(tags: string[], measuredAt = "2026-01-02T03:04:00Z", codeLabel = "abcdef1", runId = "run", codeDate = "2026-01-02T00:00:00Z"): BenchmarkRun { return { run_id: runId, code_label: codeLabel, code_date: codeDate, hardware_environment_id: "hardware", hardware_environment_label: "CPU", software_environment_id: "software", software_environment_label: "Julia", environment_pair_label: "CPU / Julia", configuration_key: "config", measured_at: measuredAt, code_state_identity: { source: { revision: `${codeLabel}234567890` } }, code_state_metadata: {}, hardware_environment_identity: {}, hardware_environment_metadata: {}, software_environment_identity: {}, software_environment_metadata: {}, run_metadata: { source: { branch: "main", tags } },  }; }
function render(tags: string[]) { return renderToStaticMarkup(<DimensionPointSelectMenu disabled={false} points={[Point]} runsByPoint={new Map([[Point.key, [benchmarkRun(tags)]]])} preferRunIdentity selectedPointKey={Point.key} onSelect={() => undefined} ariaLabel="Point" />); }

describe("DimensionPointSelectMenu", () => {
  it("restores tag-first revision labels with the measured date", () => { const html = render(["v1.2.3"]); expect(html).toContain("v1.2.3"); expect(html).toContain("2026"); });
  it("falls back to the short commit label when no tag exists", () => { const html = render([]); expect(html).toContain("abcdef1"); expect(html).toContain("2026"); });
  it("uses the newest tagged run for a revision point", () => { const html = renderToStaticMarkup(<DimensionPointSelectMenu disabled={false} points={[Point]} runsByPoint={new Map([[Point.key, [benchmarkRun(["v1.0.0"], "2026-01-01T00:00:00Z", "abcdef1", "old"), benchmarkRun(["v1.1.0"], "2026-01-03T00:00:00Z", "abcdef1", "new")]]])} preferRunIdentity selectedPointKey={Point.key} onSelect={() => undefined} ariaLabel="Point" />); expect(html).toContain("v1.1.0"); expect(html).not.toContain("v1.0.0"); });
});
