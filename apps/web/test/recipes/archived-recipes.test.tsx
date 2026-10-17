import {
  ARCHIVED_RECIPES,
  GENERIC_ERROR,
  RECIPES_LOAD_FAILED,
  RECIPES_LOADING_LABEL,
  RETRY_LABEL,
} from "@keylow/core/copy";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { recipesBackend, renderWithRecipes, resetRecipesBackend } from "./support";

import { ArchivedRecipes } from "@/components/recipes";
import { archivedSampleRecipes, sampleRecipes } from "@/components/recipes/sampleRecipes";

beforeEach(() => {
  resetRecipesBackend();
  recipesBackend.rows = [...sampleRecipes, ...archivedSampleRecipes];
});

afterEach(() => {
  cleanup();
});

async function showTable() {
  renderWithRecipes(<ArchivedRecipes />);
  return screen.findByRole("table", { name: "Recipes" });
}

describe("ArchivedRecipes", () => {
  describe("with archived recipes", () => {
    it("should be titled Archived recipes, with the note and a way back to Recipes", async () => {
      await showTable();

      expect(screen.getByRole("heading", { level: 1, name: ARCHIVED_RECIPES.title })).toBeTruthy();
      expect(screen.getByText(ARCHIVED_RECIPES.note)).toBeTruthy();
      expect(screen.getByRole("link", { name: "Recipes" }).getAttribute("href")).toBe("/recipes");
    });

    it("should list the two archived recipes with their captions and values, and no live one", async () => {
      const table = await showTable();

      const rows = within(table).getAllByRole("row").slice(1);
      expect(
        rows.map((row) =>
          within(row)
            .getAllByRole("cell")
            .map((cell) => cell.textContent),
        ),
      ).toEqual([
        ["Turkey meatballs1 serving (210 g)", "4", "29 g", "12 g", "15 g", "298 kcal", "Restore"],
        ["Veggie chilli1 serving (380 g)", "4", "14 g", "45 g", "6 g", "301 kcal", "Restore"],
      ]);
      expect(screen.queryByText("Chicken and rice")).toBeNull();
    });

    it("should not make a row a link, as an archived recipe is restored first", async () => {
      await showTable();

      expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["Recipes"]);
    });

    it("should offer a Restore button named for each recipe, in the table and in the narrow list", async () => {
      const table = await showTable();
      const list = screen.getByRole("list", { name: "Recipes" });

      expect(within(table).getByRole("button", { name: "Restore Turkey meatballs" })).toBeTruthy();
      expect(within(list).getByRole("button", { name: "Restore Veggie chilli" })).toBeTruthy();
      expect(within(list).getByText("1 serving (210 g) · makes 4")).toBeTruthy();
    });

    it("should read the library once, for live and archived recipes together", async () => {
      await showTable();

      expect(recipesBackend.reads).toHaveLength(1);
      expect(recipesBackend.reads[0]).not.toContain("is_archived=");
    });
  });

  describe("Restore", () => {
    it("should take the recipe out of the list at once and say it was restored, with no Undo", async () => {
      const table = await showTable();

      fireEvent.click(within(table).getByRole("button", { name: "Restore Turkey meatballs" }));

      await waitFor(() => {
        expect(within(table).queryByText("Turkey meatballs")).toBeNull();
      });
      expect(within(table).getByText("Veggie chilli")).toBeTruthy();
      expect(await screen.findByText("Recipe restored")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(recipesBackend.writes).toEqual(["archive"]);
      expect(recipesBackend.rows.find((row) => row.name === "Turkey meatballs")?.is_archived).toBe(
        false,
      );
    });

    it("should move focus to the next row's Restore button", async () => {
      const table = await showTable();

      fireEvent.click(within(table).getByRole("button", { name: "Restore Turkey meatballs" }));

      expect(document.activeElement).toBe(
        within(table).getByRole("button", { name: "Restore Veggie chilli" }),
      );
    });

    it("should put the row back and say something went wrong when the restore fails", async () => {
      const table = await showTable();
      recipesBackend.failsWrites = true;

      fireEvent.click(within(table).getByRole("button", { name: "Restore Turkey meatballs" }));

      expect(await screen.findByText(GENERIC_ERROR)).toBeTruthy();
      await waitFor(() => {
        expect(within(table).getByText("Turkey meatballs")).toBeTruthy();
      });
      expect(screen.queryByText("Recipe restored")).toBeNull();
    });

    it("should move focus to the Recipes link when the last recipe is restored", async () => {
      recipesBackend.rows = [...sampleRecipes, ...archivedSampleRecipes.slice(0, 1)];
      const table = await showTable();

      fireEvent.click(within(table).getByRole("button", { name: "Restore Turkey meatballs" }));

      expect(document.activeElement).toBe(screen.getByRole("link", { name: "Recipes" }));
      expect(await screen.findByRole("heading", { name: ARCHIVED_RECIPES.empty })).toBeTruthy();
    });

    it("should show Nothing archived once the last recipe is restored", async () => {
      recipesBackend.rows = [...sampleRecipes, ...archivedSampleRecipes.slice(0, 1)];
      const table = await showTable();

      fireEvent.click(within(table).getByRole("button", { name: "Restore Turkey meatballs" }));

      expect(await screen.findByRole("heading", { name: ARCHIVED_RECIPES.empty })).toBeTruthy();
      expect(screen.queryByRole("table")).toBeNull();
    });
  });

  describe("with nothing archived", () => {
    it("should say Nothing archived, with no table and no body or action", async () => {
      recipesBackend.rows = [...sampleRecipes];
      renderWithRecipes(<ArchivedRecipes />);

      expect(
        await screen.findByRole("heading", { level: 2, name: ARCHIVED_RECIPES.empty }),
      ).toBeTruthy();
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.getByRole("heading", { level: 1, name: ARCHIVED_RECIPES.title })).toBeTruthy();
      expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["Recipes"]);
      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  describe("loading and failing", () => {
    it("should name the loading region while the recipes load", async () => {
      recipesBackend.hangs = true;
      renderWithRecipes(<ArchivedRecipes />);

      expect(await screen.findByRole("status", { name: RECIPES_LOADING_LABEL })).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1, name: ARCHIVED_RECIPES.title })).toBeTruthy();
    });

    it("should say the recipes could not be loaded, with no raw error, and read them again on Try again", async () => {
      recipesBackend.fails = true;
      renderWithRecipes(<ArchivedRecipes />);

      expect(
        await screen.findByRole("heading", { level: 2, name: RECIPES_LOAD_FAILED.title }),
      ).toBeTruthy();
      expect(screen.queryByText(/database unavailable/)).toBeNull();
      const tryAgain = screen.getByRole("button", { name: RETRY_LABEL });

      recipesBackend.fails = false;
      fireEvent.click(tryAgain);

      expect(await screen.findByRole("table", { name: "Recipes" })).toBeTruthy();
    });
  });
});
