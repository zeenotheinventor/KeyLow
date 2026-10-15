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
    expect(CALORIE_RING.eaten).toBe("eaten");
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
    expect(describeCalorieRing(1039, 2200)).toBe("1,161 calories remaining of 2,200");
  });

  it("should read the whole target as remaining when nothing is eaten", () => {
    expect(describeCalorieRing(0, 2200)).toBe("2,200 calories remaining of 2,200");
  });

  it("should read nothing remaining at the target", () => {
    expect(describeCalorieRing(2200, 2200)).toBe("0 calories remaining of 2,200");
  });

  it("should read the amount over the target without a sign", () => {
    expect(describeCalorieRing(2412, 2200)).toBe("212 calories over target of 2,200");
  });

  it("should work from whole calories, so 2,200.4 against 2,200 is not over", () => {
    expect(describeCalorieRing(2200.4, 2200)).toBe("0 calories remaining of 2,200");
  });

  it("should read the calories eaten and say there is no target when the target is zero", () => {
    expect(describeCalorieRing(1039, 0)).toBe("1,039 calories eaten, no target set");
  });

  it("should read 0 calories eaten with no target and nothing eaten", () => {
    expect(describeCalorieRing(0, 0)).toBe("0 calories eaten, no target set");
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
