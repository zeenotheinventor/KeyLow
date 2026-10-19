import { describe, expect, it } from "vitest";

import { suggestionEquipmentKey } from "../../src/hooks/suggestionEquipmentKey";

describe("suggestionEquipmentKey", () => {
  it("should sort the equipment and join it with commas", () => {
    expect(suggestionEquipmentKey(["dumbbell", "barbell", "cable"])).toBe("barbell,cable,dumbbell");
  });

  it("should give the same key for the same equipment in any order", () => {
    expect(suggestionEquipmentKey(["cable", "barbell"])).toBe(
      suggestionEquipmentKey(["barbell", "cable"]),
    );
  });

  it("should count a piece of equipment listed twice once", () => {
    expect(suggestionEquipmentKey(["barbell", "barbell", "cable"])).toBe("barbell,cable");
  });

  it("should give the key of one piece of equipment as that value alone", () => {
    expect(suggestionEquipmentKey(["dumbbell"])).toBe("dumbbell");
  });
});
