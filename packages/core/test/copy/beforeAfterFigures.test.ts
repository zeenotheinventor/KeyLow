import { describe, expect, it } from "vitest";

import { beforeAfterFigures } from "../../src/copy";

describe("beforeAfterFigures", () => {
  it("should write the new value with its unit once and the old one without", () => {
    expect(beforeAfterFigures("Calories", { before: 374.1, after: 361.8 }, "energy")).toEqual({
      before: "374",
      after: "362 kcal",
      isUnchanged: false,
      accessibleName: "Calories, 374 before, 362 now",
    });
  });

  it("should write energy in whole kilocalories with the unit once, after the new value", () => {
    expect(beforeAfterFigures("Calories", { before: 374.2, after: 361.7 }, "energy")).toEqual({
      before: "374",
      after: "362 kcal",
      isUnchanged: false,
      accessibleName: "Calories, 374 before, 362 now",
    });
  });

  it("should write grams as the rest of the app writes them", () => {
    expect(beforeAfterFigures("Fat", { before: 8.125, after: 6.75 }, "grams")).toEqual({
      before: "8.1",
      after: "6.8 g",
      isUnchanged: false,
      accessibleName: "Fat, 8.1 before, 6.8 now",
    });
  });

  it("should count two values written the same as unchanged, and say so in words", () => {
    const figures = beforeAfterFigures("Carbs", { before: 43.1, after: 43.4 }, "grams");

    expect(figures.isUnchanged).toBe(true);
    expect(figures.after).toBe("43 g");
    expect(figures.accessibleName).toBe("Carbs, 43 grams, no change");
  });

  it("should count two values as the same when they are written the same", () => {
    expect(beforeAfterFigures("Carbs", { before: 42.55, after: 42.6 }, "grams")).toEqual({
      before: "43",
      after: "43 g",
      isUnchanged: true,
      accessibleName: "Carbs, 43 grams, no change",
    });
  });

  it("should write a value the food does not record as not given, with no unit", () => {
    const figures = beforeAfterFigures("Fibre", { before: 2, after: null }, "grams");

    expect(figures.after).toBe("not given");
    expect(figures.accessibleName).toBe("Fibre, 2 before, not given now");
  });

  it("should write a value the food does not give as not given in the whole figure", () => {
    expect(beforeAfterFigures("Fibre", { before: 2, after: null }, "grams")).toEqual({
      before: "2",
      after: "not given",
      isUnchanged: false,
      accessibleName: "Fibre, 2 before, not given now",
    });
  });
});
