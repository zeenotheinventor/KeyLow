import { GENERIC_ERROR, RECIPES_EMPTY, RECIPES_LIBRARY } from "@keylow/core/copy";
import { computeRecipe } from "@keylow/core/recipes";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  holdWrites,
  recipesBackend,
  releaseWrites,
  renderWithRecipes,
  resetRecipesBackend,
  sampleRecipeNamed as recipeNamed,
} from "./support";

import { RecipeLibrary } from "@/components/recipes";
import { archivedSampleRecipes, sampleRecipes } from "@/components/recipes/sampleRecipes";

const golden = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });

beforeEach(() => {
  resetRecipesBackend();
  // A copy is made from what the recipe holds, so Chicken and rice holds the golden recipe's, and the
  // library row says what those ingredients come to, as a saved recipe's does.
  const chickenAndRice = recipeNamed("Chicken and rice");
  recipesBackend.rows = [
    ...sampleRecipes.map((recipe) =>
      recipe.id === chickenAndRice.id
        ? {
            ...recipe,
            computed: computeRecipe({
              servings: golden.servings,
              yieldGrams: golden.yieldGrams,
              ingredients: golden.ingredients,
            }),
          }
        : recipe,
    ),
    ...archivedSampleRecipes,
  ];
  recipesBackend.contents.set(chickenAndRice.id, {
    instructions: ["Cook the rice.", "Fry the chicken."],
    ingredients: golden.ingredients,
  });
});

afterEach(() => {
  cleanup();
});

async function showTable() {
  renderWithRecipes(<RecipeLibrary />);
  return screen.findByRole("table", { name: "Recipes" });
}

const namesIn = (list: HTMLElement) =>
  within(list)
    .queryAllByRole("link")
    .map((link) => link.textContent);

function rowOf(table: HTMLElement, recipeName: string): HTMLElement {
  const row = within(table)
    .getAllByRole("row")
    .find((candidate) => within(candidate).queryByRole("link", { name: recipeName }) !== null);
  if (row === undefined) {
    throw new Error(`The table has no row for ${recipeName}`);
  }
  return row;
}

const cellsOf = (row: HTMLElement) =>
  within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);

const press = (button: HTMLElement) => {
  fireEvent.click(button);
};

describe("RecipeLibrary row actions", () => {
  describe("the buttons", () => {
    it("should name a Duplicate and an Archive button for every recipe, in the actions column", async () => {
      const table = await showTable();

      const row = rowOf(table, "Chicken and rice");
      const actionsCell = within(row).getAllByRole("cell").at(-1) ?? row;
      expect(
        within(actionsCell)
          .getAllByRole("button")
          .map((button) => button.getAttribute("aria-label")),
      ).toEqual(["Duplicate Chicken and rice", "Archive Chicken and rice"]);
      expect(within(table).getAllByRole("button", { name: /^Duplicate / })).toHaveLength(5);
      expect(within(table).getAllByRole("button", { name: /^Archive / })).toHaveLength(5);
    });

    it("should name the same two buttons on each row of the narrow list", async () => {
      await showTable();

      const list = screen.getByRole("list", { name: "Recipes" });
      expect(within(list).getByRole("button", { name: "Duplicate Chicken and rice" })).toBeTruthy();
      expect(within(list).getByRole("button", { name: "Archive Chicken and rice" })).toBeTruthy();
    });

    it("should keep the buttons out of the link that opens the recipe", async () => {
      const table = await showTable();

      const link = within(table).getByRole("link", { name: "Chicken and rice" });
      expect(within(link).queryByRole("button")).toBeNull();
    });
  });

  describe("Archive", () => {
    it("should take the recipe out of the list at once, say so with an Undo, and count it as archived", async () => {
      const table = await showTable();

      press(within(table).getByRole("button", { name: "Archive Chicken and rice" }));

      await waitFor(() => {
        expect(namesIn(table)).toEqual([
          "Beef chilli",
          "Lentil and tomato soup",
          "Overnight oats",
          "Spinach and cheddar frittata",
        ]);
      });
      expect(await screen.findByText("Recipe archived")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Archived recipes, 3" })).toBeTruthy();
      expect(recipesBackend.writes).toEqual(["archive"]);
    });

    it("should put the recipe back in its place when Undo is pressed", async () => {
      const table = await showTable();
      press(within(table).getByRole("button", { name: "Archive Chicken and rice" }));
      press(await screen.findByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(namesIn(table)).toEqual([
          "Beef chilli",
          "Chicken and rice",
          "Lentil and tomato soup",
          "Overnight oats",
          "Spinach and cheddar frittata",
        ]);
      });
      expect(screen.getByRole("link", { name: "Archived recipes, 2" })).toBeTruthy();
      expect(recipesBackend.writes).toEqual(["archive", "archive"]);
      expect(recipesBackend.rows.find((row) => row.name === "Chicken and rice")?.is_archived).toBe(
        false,
      );
    });

    it("should archive from the narrow list too", async () => {
      await showTable();
      const list = screen.getByRole("list", { name: "Recipes" });

      press(within(list).getByRole("button", { name: "Archive Beef chilli" }));

      await waitFor(() => {
        expect(within(list).queryByRole("link", { name: /^Beef chilli/ })).toBeNull();
      });
      expect(await screen.findByText("Recipe archived")).toBeTruthy();
    });

    it("should put the row back and say something went wrong, in the fixed sentence, when the archive fails", async () => {
      const table = await showTable();
      recipesBackend.failsWrites = true;

      press(within(table).getByRole("button", { name: "Archive Chicken and rice" }));

      expect(await screen.findByText(GENERIC_ERROR)).toBeTruthy();
      await waitFor(() => {
        expect(within(table).getByRole("link", { name: "Chicken and rice" })).toBeTruthy();
      });
      expect(screen.queryByText("Recipe archived")).toBeNull();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(screen.queryByText(/database unavailable/)).toBeNull();
    });

    it("should archive once when the button is pressed twice", async () => {
      const table = await showTable();
      holdWrites();
      const button = within(table).getByRole("button", { name: "Archive Chicken and rice" });

      press(button);
      press(button);
      releaseWrites();

      await screen.findByText("Recipe archived");
      expect(recipesBackend.writes).toEqual(["archive"]);
    });
  });

  describe("focus after Archive", () => {
    it("should move to the next row's Archive button", async () => {
      const table = await showTable();

      press(within(table).getByRole("button", { name: "Archive Chicken and rice" }));

      expect(document.activeElement).toBe(
        within(table).getByRole("button", { name: "Archive Lentil and tomato soup" }),
      );
    });

    it("should move to the row before it when the last row is archived", async () => {
      const table = await showTable();

      press(within(table).getByRole("button", { name: "Archive Spinach and cheddar frittata" }));

      expect(document.activeElement).toBe(
        within(table).getByRole("button", { name: "Archive Overnight oats" }),
      );
    });

    it("should move to the next row's Archive button in the narrow list", async () => {
      await showTable();
      const list = screen.getByRole("list", { name: "Recipes" });

      press(within(list).getByRole("button", { name: "Archive Chicken and rice" }));

      expect(document.activeElement).toBe(
        within(list).getByRole("button", { name: "Archive Lentil and tomato soup" }),
      );
    });

    it("should move to the New recipe button when the list is empty", async () => {
      recipesBackend.rows = [recipeNamed("Overnight oats")];
      const table = await showTable();

      press(within(table).getByRole("button", { name: "Archive Overnight oats" }));

      const [newRecipe] = await screen.findAllByRole("link", { name: RECIPES_LIBRARY.newRecipe });
      expect(document.activeElement).toBe(newRecipe);
      expect(await screen.findByRole("heading", { name: RECIPES_EMPTY.title })).toBeTruthy();
    });
  });

  describe("Duplicate", () => {
    it("should add the copy straight after the original, with its caption and values, and say so with an Undo", async () => {
      const table = await showTable();

      press(within(table).getByRole("button", { name: "Duplicate Chicken and rice" }));

      expect(
        await within(table).findByRole("link", { name: "Chicken and rice (copy)" }),
      ).toBeTruthy();
      expect(namesIn(table)).toEqual([
        "Beef chilli",
        "Chicken and rice",
        "Chicken and rice (copy)",
        "Lentil and tomato soup",
        "Overnight oats",
        "Spinach and cheddar frittata",
      ]);
      const original = cellsOf(rowOf(table, "Chicken and rice"));
      const copy = cellsOf(rowOf(table, "Chicken and rice (copy)"));
      expect(copy.slice(1)).toEqual(original.slice(1));
      expect(copy[0]).toBe("Chicken and rice (copy)1 serving (275 g)");
      expect(await screen.findByText("Recipe duplicated")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    });

    it("should not open the copy", async () => {
      const { push } = renderWithRecipes(<RecipeLibrary />);
      const table = await screen.findByRole("table", { name: "Recipes" });

      press(within(table).getByRole("button", { name: "Duplicate Chicken and rice" }));

      await screen.findByText("Recipe duplicated");
      expect(push).not.toHaveBeenCalled();
    });

    it("should name a second copy of the same recipe (copy 2)", async () => {
      const table = await showTable();
      press(within(table).getByRole("button", { name: "Duplicate Chicken and rice" }));
      await within(table).findByRole("link", { name: "Chicken and rice (copy)" });

      press(within(table).getByRole("button", { name: "Duplicate Chicken and rice" }));

      expect(
        await within(table).findByRole("link", { name: "Chicken and rice (copy 2)" }),
      ).toBeTruthy();
      expect(within(table).getAllByRole("link", { name: "Chicken and rice (copy)" })).toHaveLength(
        1,
      );
    });

    it("should archive the copy when Undo is pressed", async () => {
      const table = await showTable();
      press(within(table).getByRole("button", { name: "Duplicate Chicken and rice" }));
      await within(table).findByRole("link", { name: "Chicken and rice (copy)" });

      press(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(within(table).queryByRole("link", { name: "Chicken and rice (copy)" })).toBeNull();
      });
      expect(within(table).getByRole("link", { name: "Chicken and rice" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Archived recipes, 3" })).toBeTruthy();
      expect(recipesBackend.writes).toEqual(["save_recipe", "archive"]);
    });

    it("should make one copy, and mark the button busy while it is saved, when it is pressed twice", async () => {
      const table = await showTable();
      holdWrites();
      const button = within(table).getByRole("button", { name: "Duplicate Chicken and rice" });

      press(button);
      await waitFor(() => {
        expect(button.getAttribute("aria-busy")).toBe("true");
      });
      press(button);
      releaseWrites();
      await screen.findByText("Recipe duplicated");

      expect(recipesBackend.writes).toEqual(["save_recipe"]);
      expect(namesIn(table).filter((name) => name.includes("(copy"))).toEqual([
        "Chicken and rice (copy)",
      ]);
      expect(button.getAttribute("aria-busy")).toBeNull();
    });

    it("should leave the other recipes' Duplicate buttons free while one is saved", async () => {
      const table = await showTable();
      holdWrites();

      press(within(table).getByRole("button", { name: "Duplicate Chicken and rice" }));

      await waitFor(() => {
        expect(
          within(table)
            .getByRole("button", { name: "Duplicate Chicken and rice" })
            .getAttribute("aria-busy"),
        ).toBe("true");
      });
      expect(
        within(table)
          .getByRole("button", { name: "Duplicate Beef chilli" })
          .getAttribute("aria-busy"),
      ).toBeNull();
      releaseWrites();
    });

    it("should add no copy and say something went wrong, in the fixed sentence, when the save fails", async () => {
      const table = await showTable();
      recipesBackend.failsWrites = true;

      press(within(table).getByRole("button", { name: "Duplicate Chicken and rice" }));

      expect(await screen.findByText(GENERIC_ERROR)).toBeTruthy();
      expect(within(table).queryByRole("link", { name: /\(copy/ })).toBeNull();
      expect(screen.queryByText("Recipe duplicated")).toBeNull();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(screen.queryByText(/database unavailable/)).toBeNull();
    });

    it("should name the next copy (copy) again after a save failed, as the name was never taken", async () => {
      const table = await showTable();
      recipesBackend.failsWrites = true;
      press(within(table).getByRole("button", { name: "Duplicate Chicken and rice" }));
      await screen.findByText(GENERIC_ERROR);
      recipesBackend.failsWrites = false;

      press(within(table).getByRole("button", { name: "Duplicate Chicken and rice" }));

      expect(
        await within(table).findByRole("link", { name: "Chicken and rice (copy)" }),
      ).toBeTruthy();
      expect(within(table).queryByRole("link", { name: /copy 2/ })).toBeNull();
    });

    describe("two recipes with the same name", () => {
      beforeEach(() => {
        const chickenAndRice = recipeNamed("Chicken and rice");
        recipesBackend.rows = [
          ...recipesBackend.rows,
          { ...chickenAndRice, id: "00000000-0000-4000-8000-0000000000e2" },
        ];
        recipesBackend.contents.set("00000000-0000-4000-8000-0000000000e2", {
          instructions: [],
          ingredients: golden.ingredients,
        });
      });

      it("should name the second copy (copy 2) when both are saved at once", async () => {
        const table = await showTable();
        holdWrites();
        const [first, second] = within(table).getAllByRole("button", {
          name: "Duplicate Chicken and rice",
        });

        press(first ?? table);
        press(second ?? table);
        releaseWrites();

        await waitFor(() => {
          // The library puts them in name order, where "(copy 2)" comes before "(copy)".
          expect(
            namesIn(table)
              .filter((name) => name.includes("(copy"))
              .sort(),
          ).toEqual(["Chicken and rice (copy 2)", "Chicken and rice (copy)"]);
        });
      });

      it("should free the name of a copy that failed, so the next one is (copy) again", async () => {
        const table = await showTable();
        const [first, second] = within(table).getAllByRole("button", {
          name: "Duplicate Chicken and rice",
        });
        recipesBackend.failsWrites = true;
        press(first ?? table);
        await screen.findByText(GENERIC_ERROR);
        recipesBackend.failsWrites = false;

        press(second ?? table);

        await waitFor(() => {
          expect(namesIn(table).filter((name) => name.includes("(copy"))).toEqual([
            "Chicken and rice (copy)",
          ]);
        });
      });
    });

    it("should list the copy once when the library was read again before the save answered", async () => {
      const table = await showTable();
      holdWrites("after");

      press(within(table).getByRole("button", { name: "Duplicate Chicken and rice" }));
      await waitFor(() => {
        expect(recipesBackend.rows.some((row) => row.name === "Chicken and rice (copy)")).toBe(
          true,
        );
      });
      // The library is read again while the answer is held, and the read already has the copy.
      act(() => {
        window.dispatchEvent(new Event("visibilitychange"));
      });
      await within(table).findByRole("link", { name: "Chicken and rice (copy)" });
      // Later reads never answer, so what is listed is what the cache holds.
      recipesBackend.hangs = true;
      releaseWrites();
      await screen.findByText("Recipe duplicated");

      expect(within(table).getAllByRole("link", { name: "Chicken and rice (copy)" })).toHaveLength(
        1,
      );
    });

    it("should name a copy from the archived recipes' names too, so a name put away is not reused", async () => {
      recipesBackend.rows = [
        ...recipesBackend.rows,
        {
          ...recipeNamed("Chicken and rice"),
          id: "00000000-0000-4000-8000-0000000000e1",
          name: "Chicken and rice (copy)",
          is_archived: true,
        },
      ];
      const table = await showTable();

      press(within(table).getByRole("button", { name: "Duplicate Chicken and rice" }));

      expect(
        await within(table).findByRole("link", { name: "Chicken and rice (copy 2)" }),
      ).toBeTruthy();
    });
  });
});
