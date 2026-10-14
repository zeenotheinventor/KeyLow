import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NutrientTable } from "@/components/ui/NutrientTable";

const rows = [
  { label: "Energy", value: "148 kcal" },
  { label: "Protein", value: "32 g" },
  { label: "Fibre", value: null },
];

describe("NutrientTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a table named by its caption", () => {
    render(<NutrientTable caption="Nutrition per 100 g" rows={rows} />);

    expect(screen.getByRole("table", { name: "Nutrition per 100 g" })).toBeTruthy();
  });

  it("should name each nutrient in a row header", () => {
    render(<NutrientTable caption="Nutrition per 100 g" rows={rows} />);

    expect(screen.getAllByRole("rowheader").map((header) => header.textContent)).toEqual([
      "Energy",
      "Protein",
      "Fibre",
    ]);
  });

  it("should give each nutrient's value beside it", () => {
    render(<NutrientTable caption="Nutrition per 100 g" rows={rows} />);

    const protein = screen.getByRole("row", { name: /Protein/ });

    expect(within(protein).getByRole("cell").textContent).toBe("32 g");
  });

  it("should say a value is not given and never write it as 0", () => {
    render(<NutrientTable caption="Nutrition per 100 g" rows={rows} />);

    const fibre = screen.getByRole("row", { name: /Fibre/ });

    expect(within(fibre).getByRole("cell").textContent).toBe("not given");
  });

  it("should write a given value strongly and a missing one in muted text", () => {
    render(<NutrientTable caption="Nutrition per 100 g" rows={rows} />);

    expect(screen.getByText("32 g").className).toContain("font-semibold");
    expect(screen.getByText("not given").className).toContain("text-text-muted");
    expect(screen.getByText("not given").className).not.toContain("font-semibold");
  });

  it("should use tabular numerals so the values line up", () => {
    render(<NutrientTable caption="Nutrition per 100 g" rows={rows} />);

    expect(screen.getByRole("table").className).toContain("tabular-nums");
  });
});
