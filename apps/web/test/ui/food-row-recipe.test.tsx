import { NOT_GIVEN } from "@keylow/core/copy";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RecipeRowProps, RecipeTableRowProps } from "@/components/ui/FoodRow";

import { FoodRow } from "@/components/ui/FoodRow";
import { FoodTable } from "@/components/ui/FoodTable";

afterEach(() => {
  cleanup();
});

const chickenAndRice: RecipeRowProps = {
  layout: "recipe",
  nameSegments: [{ text: "Chicken and rice", matched: false }],
  href: "/recipes/chicken",
  openLabel:
    "Chicken and rice, 1 serving 275 grams, makes 4, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams, open",
  caption: "1 serving (275 g) · makes 4",
  energy: "374",
  macros: { protein: "32", carbs: "43", fat: "8.1" },
};

function renderRecipeRow(props: Partial<RecipeRowProps> = {}) {
  render(
    <ul>
      <FoodRow {...chickenAndRice} {...props} />
    </ul>,
  );
}

describe("FoodRow with the recipe layout", () => {
  it("should be one link to the recipe, named in words", () => {
    renderRecipeRow();

    const link = screen.getByRole("link", { name: chickenAndRice.openLabel });
    expect(link.getAttribute("href")).toBe("/recipes/chicken");
  });

  it("should write the servings caption and the per serving stats line", () => {
    renderRecipeRow();

    const link = screen.getByRole("link");
    expect(within(link).getByText("1 serving (275 g) · makes 4")).toBeTruthy();
    expect(link.textContent).toContain("374 kcal");
    expect(link.textContent).toContain("32 P");
    expect(link.textContent).toContain("43 C");
    expect(link.textContent).toContain("8.1 F");
  });

  it("should write the whole name in semibold when nothing is matched", () => {
    renderRecipeRow();

    expect(screen.getByText("Chicken and rice").className).toContain("font-semibold");
  });

  it("should write only the matched letters in semibold when the name is matched", () => {
    renderRecipeRow({
      nameSegments: [
        { text: "Chi", matched: true },
        { text: "cken and rice", matched: false },
      ],
    });

    expect(screen.getByText("Chi").className).toContain("font-semibold");
    expect(screen.getByText("cken and rice").className).toContain("font-normal");
  });

  it("should leave the stats line without macros when the recipe has none to show", () => {
    renderRecipeRow({ macros: undefined });

    expect(screen.getByRole("link").textContent).toContain("Needs review");
  });

  it("should put the row's buttons after the link, not inside it", () => {
    renderRecipeRow({ actions: <button type="button">Archive Chicken and rice</button> });

    const link = screen.getByRole("link");
    const button = screen.getByRole("button", { name: "Archive Chicken and rice" });
    expect(link.contains(button)).toBe(false);
    expect(link.parentElement).toBe(button.closest("li"));
  });

  it("should be plain text with no link when it has nowhere to open", () => {
    render(
      <ul>
        <FoodRow
          layout="recipe"
          nameSegments={chickenAndRice.nameSegments}
          caption="1 serving (275 g) · makes 4"
          energy="374"
          macros={{ protein: "32", carbs: "43", fat: "8.1" }}
          actions={<button type="button">Restore Chicken and rice</button>}
        />
      </ul>,
    );

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Chicken and rice")).toBeTruthy();
    expect(screen.getByText("1 serving (275 g) · makes 4")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore Chicken and rice" })).toBeTruthy();
  });
});

const chickenAndRiceCells: RecipeTableRowProps = {
  layout: "recipeTable",
  nameSegments: [{ text: "Chicken and rice", matched: false }],
  href: "/recipes/chicken",
  servingCaption: "1 serving (275 g)",
  servings: "4",
  energy: "374",
  macros: { protein: "32", carbs: "43", fat: "8.1" },
};

function renderRecipeTable(props: Partial<RecipeTableRowProps> = {}) {
  render(
    <FoodTable variant="recipe" label="Recipes">
      <FoodRow {...chickenAndRiceCells} {...props} />
    </FoodTable>,
  );
}

describe("FoodTable with the recipe variant", () => {
  it("should head the columns Recipe, Servings, Protein, Carbs, Fat and kcal, then the actions", () => {
    renderRecipeTable();

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Recipe",
      "Servings",
      "Protein",
      "Carbs",
      "Fat",
      "kcal",
      "Actions",
    ]);
  });

  it("should be a table named by its label", () => {
    renderRecipeTable();

    expect(screen.getByRole("table", { name: "Recipes" })).toBeTruthy();
  });

  it("should put the name as a link and the serving under it in the first cell", () => {
    renderRecipeTable();

    const row = screen.getByRole("row", { name: /Chicken and rice/ });
    const [recipeCell] = within(row).getAllByRole("cell");
    expect(
      within(recipeCell ?? row)
        .getByRole("link", { name: "Chicken and rice" })
        .getAttribute("href"),
    ).toBe("/recipes/chicken");
    expect(within(recipeCell ?? row).getByText("1 serving (275 g)")).toBeTruthy();
  });

  it("should write the servings, the macros in grams and the energy in the cells after it", () => {
    renderRecipeTable();

    const row = screen.getByRole("row", { name: /Chicken and rice/ });
    expect(
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["Chicken and rice1 serving (275 g)", "4", "32 g", "43 g", "8.1 g", "374 kcal", ""]);
  });

  it("should write a dash that a screen reader hears as not given for a macro the recipe lacks", () => {
    renderRecipeTable({ macros: { protein: "32", carbs: null, fat: "8.1" } });

    expect(screen.getByRole("cell", { name: NOT_GIVEN }).textContent).toBe("–");
  });

  it("should write the matched letters in semibold in the name link", () => {
    renderRecipeTable({
      nameSegments: [
        { text: "Chi", matched: true },
        { text: "cken and rice", matched: false },
      ],
    });

    expect(screen.getByText("Chi").className).toContain("font-semibold");
    expect(screen.getByText("cken and rice").className).toContain("font-normal");
  });

  it("should put the row's buttons in the last cell", () => {
    renderRecipeTable({ actions: <button type="button">Archive Chicken and rice</button> });

    const row = screen.getByRole("row", { name: /Chicken and rice/ });
    const cells = within(row).getAllByRole("cell");
    expect(
      within(cells.at(-1) ?? row).getByRole("button", { name: "Archive Chicken and rice" }),
    ).toBeTruthy();
  });

  it("should write the name as plain text when the recipe has nowhere to open", () => {
    render(
      <FoodTable variant="recipe" label="Recipes">
        <FoodRow
          layout="recipeTable"
          nameSegments={chickenAndRiceCells.nameSegments}
          servingCaption="1 serving (275 g)"
          servings="4"
          energy="374"
          macros={{ protein: "32", carbs: "43", fat: "8.1" }}
        />
      </FoodTable>,
    );

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Chicken and rice")).toBeTruthy();
    expect(screen.getByText("1 serving (275 g)")).toBeTruthy();
  });
});
