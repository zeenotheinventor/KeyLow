import { describe, expect, it } from "vitest";

import {
  CALORIE_RING,
  MACRO_NAMES,
  describeCalorieRing,
  describeEatenLine,
  describeMacroBar,
  describeMacroTarget,
  describeTargetLine,
} from "../../src/copy";

describe("calorie ring wording", () => {
  it("should pin the drawn words", () => {
    expect(CALORIE_RING.remaining).toBe("remaining");
    expect(CALORIE_RING.overTarget).toBe("over target");
  });

  it("should name the macros as the diary draws them", () => {
    expect(MACRO_NAMES).toEqual({ protein: "Protein", carbs: "Carbs", fat: "Fat" });
  });
});

describe("describeEatenLine and describeTargetLine", () => {
  it("should write the eaten line with a thousands separator", () => {
    expect(describeEatenLine(1039)).toBe("1,039 eaten");
  });

  it("should write the target line without (est.) unless asked", () => {
    expect(describeTargetLine(2200, false)).toBe("2,200 target");
  });

  it("should write (est.) on the target line when the target is an estimate", () => {
    expect(describeTargetLine(2200, true)).toBe("2,200 target (est.)");
  });
});

describe("describeCalorieRing", () => {
  it("should read what is left under the target", () => {
    expect(describeCalorieRing(1039, 2200)).toBe("1,039 eaten of 2,200 target, 1,161 remaining");
  });

  it("should read nothing remaining at the target", () => {
    expect(describeCalorieRing(2200, 2200)).toBe("2,200 eaten of 2,200 target, 0 remaining");
  });

  it("should read the amount over the target without a sign", () => {
    expect(describeCalorieRing(2412, 2200)).toBe("2,412 eaten of 2,200 target, 212 over");
  });

  it("should work from whole calories, so 2,200.4 against 2,200 is not over", () => {
    expect(describeCalorieRing(2200.4, 2200)).toBe("2,200 eaten of 2,200 target, 0 remaining");
  });
});

describe("describeMacroBar", () => {
  it("should read grams eaten of the target", () => {
    expect(describeMacroBar("Protein", 86, 160)).toBe("Protein: 86 of 160 grams");
  });

  it("should keep one decimal only under 10 grams", () => {
    expect(describeMacroBar("Fat", 4.5, 70)).toBe("Fat: 4.5 of 70 grams");
  });

  it("should add the grams over when the target is passed", () => {
    expect(describeMacroBar("Fat", 81, 70)).toBe("Fat: 81 of 70 grams, 11 over");
  });

  it("should read only the grams eaten when there is no target", () => {
    expect(describeMacroBar("Carbs", 129.1, 0)).toBe("Carbs: 129 grams");
  });
});

describe("describeMacroTarget", () => {
  it("should write the target after a slash, in grams", () => {
    expect(describeMacroTarget(160)).toBe("/ 160 g");
  });

  it("should write only the unit when there is no target", () => {
    expect(describeMacroTarget(0)).toBe("g");
  });
});
