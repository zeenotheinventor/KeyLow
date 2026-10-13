import { describe, expect, it } from "vitest";

import { describeFoodSource } from "../../src/copy";

describe("describeFoodSource", () => {
  it.each([
    ["off", "Open Food Facts"],
    ["cofid", "UK CoFID"],
    ["user", "Yours"],
  ] as const)("should name the %s source plainly as %s", (source, expected) => {
    expect(describeFoodSource(source)).toBe(expected);
  });

  it("should not use the old labels Own food or CoFID alone", () => {
    const labels = (["off", "cofid", "user"] as const).map(describeFoodSource);

    expect(labels).not.toContain("Own food");
    expect(labels).not.toContain("CoFID");
  });
});
