import { describe, expect, it } from "vitest";
import { resolveSafeUserUrl } from "./url";

describe("resolveSafeUserUrl", () => {
  const baseUrl = "https://example.test/benchmarks/index.html";

  it("accepts relative, http, and https URLs", () => {
    expect(resolveSafeUserUrl("./project", baseUrl)).toBe("https://example.test/benchmarks/project");
    expect(resolveSafeUserUrl("http://example.org/project", baseUrl)).toBe("http://example.org/project");
    expect(resolveSafeUserUrl("https://example.org/project", baseUrl)).toBe("https://example.org/project");
    expect(resolveSafeUserUrl("HTTPS://example.org/project", baseUrl)).toBe("https://example.org/project");
  });

  it("rejects non-web protocols", () => {
    expect(resolveSafeUserUrl("javascript:alert(1)", baseUrl)).toBeNull();
    expect(resolveSafeUserUrl("data:text/html,test", baseUrl)).toBeNull();
    expect(resolveSafeUserUrl("file:///tmp/project", baseUrl)).toBeNull();
  });
});
