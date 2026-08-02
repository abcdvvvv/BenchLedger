import { describe, expect, it } from "vitest";
import { disambiguatedLabels } from "./selection-options";

describe("selection option labels", () => {
  it("adds stable identity suffixes only when visible labels collide", () => {
    const items = [
      { id: "alpha-123", label: "CPU A" },
      { id: "beta-456", label: "CPU A" },
      { id: "gamma-789", label: "CPU B" }
    ];

    expect(disambiguatedLabels(items, (item) => item.label, (item) => item.id.slice(0, 5))).toEqual([
      "CPU A · alpha",
      "CPU A · beta-",
      "CPU B"
    ]);
  });
});
