import { describe, expect, it } from "vitest";

import { bodyMapScaleOf } from "../../src/training";

describe("bodyMapScaleOf", () => {
  it("should open on Volume when the address asks for it", () => {
    expect(bodyMapScaleOf("volume")).toBe("volume");
  });

  it.each([undefined, "", "heat", "gap", "Volume", ["volume"], ["volume", "gap"], 1, null])(
    "should open on Heat for %j, as a cold link does",
    (scale) => {
      expect(bodyMapScaleOf(scale)).toBe("heat");
    },
  );
});
