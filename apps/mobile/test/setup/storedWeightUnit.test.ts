import { storedWeightUnitOf } from "../../components/SetupScreen/storedWeightUnit";

describe("storedWeightUnitOf", () => {
  it.each(["kg", "lb", "st"])("should keep the stored unit %s", (unit) => {
    expect(storedWeightUnitOf(unit)).toBe(unit);
  });

  it("should read nothing stored as null", () => {
    expect(storedWeightUnitOf(null)).toBeNull();
  });

  it("should read text that is not a weight unit as nothing stored", () => {
    expect(storedWeightUnitOf("stone")).toBeNull();
  });
});
