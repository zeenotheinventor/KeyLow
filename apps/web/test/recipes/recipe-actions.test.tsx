import { useRecipes } from "@keylow/api-client";
import { GENERIC_ERROR } from "@keylow/core/copy";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  holdWrites,
  recipesBackend,
  releaseWrites,
  renderWithRecipes,
  resetRecipesBackend,
  sampleRecipeNamed,
} from "./support";

import type { ArchiveFollowUp, DuplicateFollowUp } from "@/lib/recipeActions";

import { sampleRecipes } from "@/components/recipes/sampleRecipes";
import { useRecipeActions } from "@/lib/recipeActions";

const chickenAndRice = sampleRecipeNamed("Chicken and rice");

beforeEach(() => {
  resetRecipesBackend();
  recipesBackend.rows = [...sampleRecipes];
  recipesBackend.contents.set(chickenAndRice.id, {
    instructions: [],
    ingredients: buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 }).ingredients,
  });
});

afterEach(() => {
  cleanup();
});

// The actions as a screen uses them, with the library they change listed beside the buttons.
function Screen({
  duplicateFollowUp,
  archiveFollowUp,
}: {
  duplicateFollowUp?: DuplicateFollowUp;
  archiveFollowUp?: ArchiveFollowUp;
}) {
  const library = useRecipes({ archived: true });
  const actions = useRecipeActions();

  return (
    <>
      <ul aria-label="Library">
        {library.data?.map((recipe) => (
          <li key={recipe.id}>{recipe.is_archived ? `${recipe.name} (archived)` : recipe.name}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          actions.duplicate(chickenAndRice, duplicateFollowUp);
        }}
      >
        Duplicate
      </button>
      <button
        type="button"
        onClick={() => {
          actions.archive(chickenAndRice, archiveFollowUp);
        }}
      >
        Archive
      </button>
      <button
        type="button"
        onClick={() => {
          actions.restore(chickenAndRice);
        }}
      >
        Restore
      </button>
      <p>{actions.isDuplicating(chickenAndRice.id) ? "Duplicating" : "Not duplicating"}</p>
    </>
  );
}

async function showScreen(props: Parameters<typeof Screen>[0] = {}) {
  renderWithRecipes(<Screen {...props} />);
  await screen.findByText("Chicken and rice");
}

const press = (name: string) => {
  fireEvent.click(screen.getByRole("button", { name }));
};

describe("useRecipeActions", () => {
  describe("follow-ups", () => {
    it("should archive once when Archive is pressed twice", async () => {
      await showScreen();
      holdWrites();

      press("Archive");
      press("Archive");
      releaseWrites();

      await screen.findByText("Recipe archived");
      expect(recipesBackend.writes).toEqual(["archive"]);
    });

    it("should run the archive follow-up when the archive worked", async () => {
      const onArchived = vi.fn<() => void>();
      await showScreen({ archiveFollowUp: { onArchived } });

      press("Archive");

      expect(await screen.findByText("Recipe archived")).toBeTruthy();
      expect(onArchived).toHaveBeenCalledTimes(1);
    });

    it("should not run the archive follow-up when the archive failed", async () => {
      const onArchived = vi.fn<() => void>();
      await showScreen({ archiveFollowUp: { onArchived } });
      recipesBackend.failsWrites = true;

      press("Archive");

      expect(await screen.findByText(GENERIC_ERROR)).toBeTruthy();
      expect(onArchived).not.toHaveBeenCalled();
    });

    it("should still show the toast when the follow-up throws", async () => {
      await showScreen({
        archiveFollowUp: {
          onArchived: () => {
            throw new Error("The screen could not leave");
          },
        },
      });

      press("Archive");

      expect(await screen.findByText("Recipe archived")).toBeTruthy();
    });

    it("should run the duplicate follow-up with the saved copy, and the undo follow-up once the copy is archived", async () => {
      const onSaved = vi.fn<(copy: { name: string }) => void>();
      const onUndone = vi.fn<(copy: { name: string }) => void>();
      await showScreen({ duplicateFollowUp: { onSaved, onUndone } });

      press("Duplicate");
      await screen.findByText("Recipe duplicated");
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(onSaved.mock.calls[0]?.[0].name).toBe("Chicken and rice (copy)");
      expect(onUndone).not.toHaveBeenCalled();

      press("Undo");

      await waitFor(() => {
        expect(onUndone).toHaveBeenCalledTimes(1);
      });
      expect(onUndone.mock.calls[0]?.[0].name).toBe("Chicken and rice (copy)");
    });

    it("should not run the undo follow-up when archiving the copy failed", async () => {
      const onUndone = vi.fn<() => void>();
      await showScreen({ duplicateFollowUp: { onUndone } });
      press("Duplicate");
      await screen.findByText("Recipe duplicated");
      recipesBackend.failsWrites = true;

      press("Undo");

      expect(await screen.findByText(GENERIC_ERROR)).toBeTruthy();
      expect(onUndone).not.toHaveBeenCalled();
    });

    it("should run no duplicate follow-up when the save failed", async () => {
      const onSaved = vi.fn<() => void>();
      await showScreen({ duplicateFollowUp: { onSaved } });
      recipesBackend.failsWrites = true;

      press("Duplicate");

      expect(await screen.findByText(GENERIC_ERROR)).toBeTruthy();
      expect(onSaved).not.toHaveBeenCalled();
    });
  });

  describe("Duplicate", () => {
    it("should say it is duplicating the recipe until the copy is saved", async () => {
      await showScreen();
      expect(screen.getByText("Not duplicating")).toBeTruthy();

      press("Duplicate");

      expect(screen.getByText("Duplicating")).toBeTruthy();
      expect(await screen.findByText("Recipe duplicated")).toBeTruthy();
      expect(screen.getByText("Not duplicating")).toBeTruthy();
    });

    it("should join a second Duplicate of the same recipe while the first copy is saved, so there is one copy and one follow-up", async () => {
      const onSaved = vi.fn<() => void>();
      await showScreen({ duplicateFollowUp: { onSaved } });
      holdWrites();

      press("Duplicate");
      press("Duplicate");
      releaseWrites();

      await screen.findByText("Recipe duplicated");
      expect(recipesBackend.writes).toEqual(["save_recipe"]);
      expect(onSaved).toHaveBeenCalledTimes(1);
    });

    it("should say it is no longer duplicating after a failed save", async () => {
      await showScreen();
      recipesBackend.failsWrites = true;

      press("Duplicate");
      await screen.findByText(GENERIC_ERROR);

      expect(screen.getByText("Not duplicating")).toBeTruthy();
    });

    it("should list the copy once, though it joins the library as it is saved and again when the library is read", async () => {
      await showScreen();

      press("Duplicate");
      await screen.findByText("Recipe duplicated");
      await waitFor(() => {
        expect(recipesBackend.reads.length).toBeGreaterThan(1);
      });

      expect(screen.getAllByText("Chicken and rice (copy)")).toHaveLength(1);
    });
  });

  describe("Restore", () => {
    it("should bring an archived recipe back and say so", async () => {
      recipesBackend.rows = recipesBackend.rows.map((recipe) =>
        recipe.id === chickenAndRice.id ? { ...recipe, is_archived: true } : recipe,
      );
      renderWithRecipes(<Screen />);
      await screen.findByText("Chicken and rice (archived)");

      press("Restore");

      expect(await screen.findByText("Recipe restored")).toBeTruthy();
      expect(screen.getByText("Chicken and rice")).toBeTruthy();
    });
  });
});
