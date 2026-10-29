import { describe, expect, it } from "vitest";

import { usdaFoodId } from "../../../scripts/usda/usdaFoodId";

describe("usdaFoodId", () => {
  it("should be the version 5 UUID of usda:<fdc_id> under the fixed USDA namespace", () => {
    // Worked out with Python's uuid.uuid5 over the namespace 3b55216d-1c4f-4c9b-b753-eafc427cc51b
    // and the names "usda:172385" and "usda:173625", so the TypeScript is checked against a second implementation.
    expect(usdaFoodId("172385")).toBe("6c08a1d8-607f-5a16-9266-0ecbece9a52c");
    expect(usdaFoodId("173625")).toBe("5e0b36c2-b52d-5de9-9c5f-b878142e481b");
  });
});
