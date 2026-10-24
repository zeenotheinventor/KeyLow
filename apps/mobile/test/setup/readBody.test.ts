import {
  fieldTextsOf,
  readHeight,
  shouldShowProblem,
} from "../../components/SetupScreen/steps/BodyStep/readBody";

const texts = (centimetres: string, feet: string, inches: string, weight: string) => ({
  centimetres,
  feet,
  inches,
  weight,
});

describe("readHeight", () => {
  it("should read centimetres", () => {
    expect(readHeight(texts("180", "", "", ""), "cm")).toEqual({ ok: true, heightCm: 180 });
  });

  it("should read feet and inches", () => {
    expect(readHeight(texts("", "5", "11", ""), "ft_in")).toEqual({ ok: true, heightCm: 180.34 });
  });

  it("should read only the fields of the unit it is asked for", () => {
    expect(readHeight(texts("180", "", "", ""), "ft_in")).toEqual({ ok: false, reason: "empty" });
    expect(readHeight(texts("", "5", "11", ""), "cm")).toEqual({ ok: false, reason: "empty" });
  });

  it.each([
    [texts("90", "", "", ""), "cm", "too-low"],
    [texts("251", "", "", ""), "cm", "too-high"],
    [texts("", "5", "12", ""), "ft_in", "inches-out-of-range"],
    [texts("", "3", "3", ""), "ft_in", "too-low"],
  ] as const)("should refuse %j in %s with %s", (fields, unit, reason) => {
    expect(readHeight(fields, unit)).toEqual({ ok: false, reason });
  });
});

describe("fieldTextsOf", () => {
  it("should show kilograms and centimetres, the weight to one decimal", () => {
    expect(fieldTextsOf({ heightCm: 180, weightKg: 80 }, "kg")).toEqual(
      texts("180", "", "", "80.0"),
    );
  });

  it("should show feet and inches and pounds: 180 cm reads 5 ft 11 in and 80.0 kg reads 176.4 lb", () => {
    expect(fieldTextsOf({ heightCm: 180, weightKg: 80 }, "lb")).toEqual(
      texts("", "5", "11", "176.4"),
    );
  });

  it("should round the height to a tenth of a centimetre and keep a tenth", () => {
    expect(fieldTextsOf({ heightCm: 175.26, weightKg: 80 }, "kg").centimetres).toBe("175.3");
    expect(fieldTextsOf({ heightCm: 175.5, weightKg: 80 }, "kg").centimetres).toBe("175.5");
  });

  it("should show the weight of 80.0137 kg, which is 176.4 lb, as 80.0 kg", () => {
    expect(fieldTextsOf({ heightCm: 180, weightKg: 80.0137 }, "kg").weight).toBe("80.0");
  });

  it("should leave a field empty that has no value", () => {
    expect(fieldTextsOf({ heightCm: undefined, weightKg: undefined }, "kg")).toEqual(
      texts("", "", "", ""),
    );
    expect(fieldTextsOf({ heightCm: undefined, weightKg: undefined }, "lb")).toEqual(
      texts("", "", "", ""),
    );
  });

  it("should show a saved height that is out of range in centimetres, so the error can say why", () => {
    expect(fieldTextsOf({ heightCm: 90, weightKg: undefined }, "kg").centimetres).toBe("90");
  });

  it("should not turn a saved height that is out of range into a usable one in feet and inches", () => {
    expect(fieldTextsOf({ heightCm: 90, weightKg: undefined }, "lb")).toEqual(
      texts("", "", "", ""),
    );
  });

  it("should show 100 cm as 3 ft 4 in, the shortest height feet and inches can say", () => {
    expect(fieldTextsOf({ heightCm: 100, weightKg: undefined }, "lb")).toEqual(
      texts("", "3", "4", ""),
    );
  });
});

describe("shouldShowProblem", () => {
  it("should hold back a number that is too low until the field has been left, because more digits may mend it", () => {
    expect(shouldShowProblem("too-low", { hasLeft: false, hasTyped: true })).toBe(false);
    expect(shouldShowProblem("too-low", { hasLeft: true, hasTyped: true })).toBe(true);
  });

  it.each(["too-high", "too-many-decimals", "not-a-number", "inches-out-of-range"] as const)(
    "should show %s at once, because more typing cannot mend it",
    (reason) => {
      expect(shouldShowProblem(reason, { hasLeft: false, hasTyped: true })).toBe(true);
    },
  );

  it("should show a number that is too low when it was not typed, such as a saved one", () => {
    expect(shouldShowProblem("too-low", { hasLeft: false, hasTyped: false })).toBe(true);
  });

  it("should show nothing for an empty field, whether or not it has been left", () => {
    expect(shouldShowProblem("empty", { hasLeft: true, hasTyped: true })).toBe(false);
  });
});
