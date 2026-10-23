import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BeforeAfterRow, beforeAfterFigures } from "@/components/recipes/BeforeAfterRow";

afterEach(cleanup);

describe("beforeAfterFigures", () => {
  it("should write the new value with its unit once and the old one without", () => {
    expect(beforeAfterFigures("Calories", { before: 374.1, after: 361.8 }, "energy")).toEqual({
      before: "374",
      after: "362 kcal",
      isUnchanged: false,
      accessibleName: "Calories, 374 before, 362 now",
    });
  });

  it("should count two values written the same as unchanged, and say so in words", () => {
    const figures = beforeAfterFigures("Carbs", { before: 43.1, after: 43.4 }, "grams");

    expect(figures.isUnchanged).toBe(true);
    expect(figures.after).toBe("43 g");
    expect(figures.accessibleName).toBe("Carbs, 43 grams, no change");
  });

  it("should write a value the food does not record as not given, with no unit", () => {
    const figures = beforeAfterFigures("Fibre", { before: 2, after: null }, "grams");

    expect(figures.after).toBe("not given");
    expect(figures.accessibleName).toBe("Fibre, 2 before, not given now");
  });
});

describe("BeforeAfterRow", () => {
  it("should read as one group named in words, with the old value, the new value and the label", () => {
    render(
      <BeforeAfterRow
        label="Calories"
        figures={beforeAfterFigures("Calories", { before: 374, after: 362 }, "energy")}
      />,
    );

    const row = screen.getByRole("group", { name: "Calories, 374 before, 362 now" });
    expect(within(row).getByText("Calories")).toBeTruthy();
    expect(within(row).getByText("374")).toBeTruthy();
    expect(within(row).getByText("362 kcal")).toBeTruthy();
    expect(within(row).queryByText("no change")).toBeNull();
  });

  it("should write an unchanged figure once, followed by no change", () => {
    render(
      <BeforeAfterRow
        label="Carbs"
        figures={beforeAfterFigures("Carbs", { before: 43, after: 43 }, "grams")}
      />,
    );

    const row = screen.getByRole("group", { name: "Carbs, 43 grams, no change" });
    expect(within(row).getByText("43 g")).toBeTruthy();
    expect(within(row).getByText("no change")).toBeTruthy();
  });

  it("should leave out the label for a figure that sits under a title that says it", () => {
    render(
      <BeforeAfterRow
        figures={beforeAfterFigures("Calories", { before: 600, after: 550 }, "energy")}
      />,
    );

    const row = screen.getByRole("group", { name: "Calories, 600 before, 550 now" });
    expect(within(row).queryByText("Calories")).toBeNull();
    expect(within(row).getByText("550 kcal")).toBeTruthy();
  });
});
