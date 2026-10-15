import { describe, expect, it } from "vitest";

import { CURRENT_HOUR_LABEL, describeFoodsAtHour } from "../../src/copy";

describe("the food log's words", () => {
  it("should name the card of an hour's foods", () => {
    expect(describeFoodsAtHour("08:00")).toBe("Foods at 08:00");
  });

  it("should name the current hour's dot", () => {
    expect(CURRENT_HOUR_LABEL).toBe("Current hour");
  });
});
