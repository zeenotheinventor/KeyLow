import { describe, expect, it } from "vitest";

import { recipeCreatedCard } from "./cardFixtures";
import {
  assistantCardSchema,
  buildRecipeArchivedCard,
  buildRecipeCreatedCard,
  buildRecipeUpdatedCard,
  confirmArchiveButtons,
  confirmArchiveQuestion,
  withActionIds,
} from "../../src/assistant";

const recipeId = "00000000-0000-4000-8000-0000000000e1";
const actionIds: [string, ...string[]] = ["00000000-0000-4000-8000-0000000000d1"];

// The per serving figures of the board's Chicken and rice, before any rounding.
const perServing = { kcal: 550.25, protein_g: 37.05, carbs_g: 78.9, fat_g: 8.6 };

const chickenAndRice = { id: recipeId, name: "Chicken and rice", servings: 4, perServing };

describe("buildRecipeCreatedCard", () => {
  it("should build the board's card for Chicken and rice", () => {
    const draft = buildRecipeCreatedCard(chickenAndRice);

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      ...recipeCreatedCard,
      actionIds,
    });
  });

  it("should say 1 serving for a single serving and keep a fraction of one", () => {
    expect(buildRecipeCreatedCard({ ...chickenAndRice, servings: 1 }).title).toBe(
      "Added recipe Chicken and rice, 1 serving",
    );
    expect(buildRecipeCreatedCard({ ...chickenAndRice, servings: 2.5 }).title).toBe(
      "Added recipe Chicken and rice, 2.5 servings",
    );
  });

  it("should leave out a figure the recipe does not know, and never write it as 0", () => {
    const draft = buildRecipeCreatedCard({
      ...chickenAndRice,
      perServing: { kcal: 300, protein_g: null, carbs_g: null, fat_g: 4 },
    });

    expect(draft.sub).toBe("Per serving 300 kcal · F 4 g");
  });

  it("should have no sub when no figure is known", () => {
    const draft = buildRecipeCreatedCard({
      ...chickenAndRice,
      perServing: { kcal: null, protein_g: null, carbs_g: null, fat_g: null },
    });

    expect(draft.sub).toBeNull();
  });
});

describe("buildRecipeArchivedCard", () => {
  it("should build the changes board's words for an archived recipe, with Undo", () => {
    const draft = buildRecipeArchivedCard({ name: "Pasta bake" });

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      actionIds,
      kind: "recipe_archived",
      title: "Archived recipe Pasta bake",
      sub: null,
      rows: [],
      totalText: null,
      note: null,
      link: null,
      undo: "available",
      undoneSub: "Restored Pasta bake",
    });
  });
});

describe("buildRecipeUpdatedCard", () => {
  it("should word the change, say Undo is off and link into the recipe editor", () => {
    const draft = buildRecipeUpdatedCard(chickenAndRice);

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      actionIds,
      kind: "recipe_updated",
      title: "Updated recipe Chicken and rice",
      sub: "Per serving 550 kcal · P 37 g · C 79 g · F 8.6 g",
      rows: [],
      totalText: null,
      note: "Undo is off for changes. Edit it again in the recipe editor.",
      link: { label: "Open in recipe editor", target: { screen: "recipe_editor", recipeId } },
      undo: "unavailable",
      undoneSub: null,
    });
  });
});

describe("the archive confirmation", () => {
  it("should give the board's two buttons", () => {
    expect(confirmArchiveButtons()).toEqual({
      confirmLabel: "Archive recipe",
      cancelLabel: "Keep it",
    });
  });

  it("should ask the board's question", () => {
    expect(confirmArchiveQuestion("Chicken and rice")).toBe(
      "Archive Chicken and rice? It leaves your recipe list. Entries already logged from it stay in your diary.",
    );
  });
});
