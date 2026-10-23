import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { IngredientTableRowProps } from "@/components/ui/FoodRow";

import { FoodRow } from "@/components/ui/FoodRow";
import { FoodTable } from "@/components/ui/FoodTable";

afterEach(() => {
  cleanup();
});

const onions: IngredientTableRowProps = {
  layout: "ingredientTable",
  nameSegments: [{ text: "Onions, raw", matched: false }],
  amount: "1 medium (110 g)",
  energy: "39",
  macros: { protein: "1.1", carbs: "8.8", fat: "0.1" },
};

function renderIngredients(props: Partial<IngredientTableRowProps> = {}) {
  render(
    <FoodTable variant="ingredient" label="Ingredients">
      <FoodRow {...onions} {...props} />
    </FoodTable>,
  );
}

describe("FoodTable with the ingredient variant", () => {
  it("should head the columns Food, Amount, Protein, Carbs, Fat and kcal, then the actions", () => {
    renderIngredients();

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Food",
      "Amount",
      "Protein",
      "Carbs",
      "Fat",
      "kcal",
      "Actions",
    ]);
  });

  it("should write an ingredient as its name, its amount, its macros in grams and its energy", () => {
    renderIngredients();
    const row = screen.getByRole("row", { name: /Onions, raw/ });

    expect(
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["Onions, raw", "1 medium (110 g)", "1.1 g", "8.8 g", "0.1 g", "39 kcal", ""]);
  });

  it("should draw each macro as the bare number and keep the unit for a screen reader", () => {
    renderIngredients();
    const row = screen.getByRole("row", { name: /Onions, raw/ });

    for (const [value, name] of [
      ["1.1", "1.1 g"],
      ["8.8", "8.8 g"],
      ["0.1", "0.1 g"],
    ] as const) {
      const cell = within(row).getByRole("cell", { name });

      expect(within(cell).getByText(value).className).not.toContain("sr-only");
      expect(within(cell).getByText("g").className).toContain("sr-only");
    }
  });

  it("should write a dash for a macro that is not given, and for no energy", () => {
    renderIngredients({ energy: undefined, macros: { protein: null, carbs: "8.8", fat: "0.1" } });
    const row = screen.getByRole("row", { name: /Onions, raw/ });

    expect(
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["Onions, raw", "1 medium (110 g)", "–", "8.8 g", "0.1 g", "–", ""]);
  });

  it("should put the row's buttons in the last cell, hidden until hover or focus", () => {
    renderIngredients({ actions: <button type="button">Edit Onions, raw</button> });
    const row = screen.getByRole("row", { name: /Onions, raw/ });
    const cells = within(row).getAllByRole("cell");
    const actionsCell = cells[cells.length - 1];

    expect(
      within(actionsCell ?? row).getByRole("button", { name: "Edit Onions, raw" }),
    ).toBeTruthy();
    expect(actionsCell?.className).toContain("opacity-0");
    expect(actionsCell?.className).toContain("group-hover/row:opacity-100");
    expect(actionsCell?.className).toContain("group-focus-within/row:opacity-100");
  });

  it("should leave the last cell as it was with no buttons", () => {
    renderIngredients();
    const row = screen.getByRole("row", { name: /Onions, raw/ });
    const cells = within(row).getAllByRole("cell");

    expect(cells[cells.length - 1]?.className).not.toContain("opacity-0");
  });
});
