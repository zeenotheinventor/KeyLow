import { describe, expect, it } from "vitest";

import { portionId } from "../../../scripts/portions/portionId";

describe("portionId", () => {
  it("should be the version 5 UUID of the food code and the label under the fixed namespace", () => {
    // Worked out with Python's uuid.uuid5 over the namespace 7c0f3a1e-5b2d-4e8a-9c46-2d1f8b6a4e90
    // and the name "14-318|1 medium", so the TypeScript is checked against a second implementation.
    expect(portionId("14-318", "1 medium")).toBe("124c2ae2-e051-5f97-9efa-8e44fce7ea55");
    expect(portionId("14-318", "1 large")).toBe("99b52932-5e36-5bb0-ab03-09b0ebc83321");
  });

  it("should give the same id for the same food code and label", () => {
    expect(portionId("18-317", "1 thigh")).toBe(portionId("18-317", "1 thigh"));
  });

  it("should change the id when only the label changes", () => {
    expect(portionId("14-318", "1 medium")).not.toBe(portionId("14-318", "1 large"));
  });

  it("should change the id when only the food code changes", () => {
    expect(portionId("14-318", "1 medium")).not.toBe(portionId("14-319", "1 medium"));
  });
});
