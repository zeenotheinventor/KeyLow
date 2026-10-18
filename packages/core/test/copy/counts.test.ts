import { describe, expect, it } from "vitest";

import { describeCount } from "../../src/copy";

describe("describeCount", () => {
  it("should use the singular for exactly one", () => {
    expect(describeCount(1, "session", "sessions")).toBe("1 session");
  });

  it("should use the plural for none and for many", () => {
    expect(describeCount(0, "session", "sessions")).toBe("0 sessions");
    expect(describeCount(3, "session", "sessions")).toBe("3 sessions");
  });
});
