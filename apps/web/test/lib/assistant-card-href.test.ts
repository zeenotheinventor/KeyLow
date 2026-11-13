import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { assistantCardHref } from "@/lib/assistantCardHref";

const RECIPE_ID = "00000000-0000-4000-8000-0000000000e1";
const FOOD_ID = "00000000-0000-4000-8000-0000000000f1";
const ROUTINE_ID = "00000000-0000-4000-8000-0000000000e2";
const SESSION_ID = "00000000-0000-4000-8000-0000000000e3";

// The page an address needs under app/(dashboard), so a rename that leaves a card's link on the not-found
// page fails here.
const dashboardDirectory = join(__dirname, "..", "..", "app", "(dashboard)");
const pageExists = (...segments: string[]) =>
  existsSync(join(dashboardDirectory, ...segments, "page.tsx"));

describe("assistantCardHref", () => {
  it("should open the recipe editor for the recipe", () => {
    expect(assistantCardHref({ screen: "recipe_editor", recipeId: RECIPE_ID })).toBe(
      `/recipes/${RECIPE_ID}/edit`,
    );
    expect(pageExists("recipes", "[id]", "edit")).toBe(true);
  });

  it("should open the recipe editor with its add-ingredient search on the word", () => {
    expect(
      assistantCardHref({
        screen: "recipe_add_ingredient",
        recipeId: RECIPE_ID,
        query: "white wine & stock",
      }),
    ).toBe(`/recipes/${RECIPE_ID}/edit?addIngredient=white%20wine%20%26%20stock`);
  });

  it("should open the food", () => {
    expect(assistantCardHref({ screen: "own_food", foodId: FOOD_ID })).toBe(`/foods/${FOOD_ID}`);
    expect(pageExists("foods", "[id]")).toBe(true);
  });

  it("should open the diary on the day", () => {
    expect(assistantCardHref({ screen: "diary_day", localDate: "2026-10-24" })).toBe(
      "/diary?date=2026-10-24",
    );
    expect(pageExists("diary")).toBe(true);
  });

  it("should open the routine in its editor", () => {
    expect(assistantCardHref({ screen: "routine_editor", routineId: ROUTINE_ID })).toBe(
      `/train/routines/${ROUTINE_ID}`,
    );
    expect(pageExists("train", "routines", "[id]")).toBe(true);
  });

  it("should open the logged session", () => {
    expect(assistantCardHref({ screen: "session_detail", sessionId: SESSION_ID })).toBe(
      `/train/history/${SESSION_ID}`,
    );
    expect(pageExists("train", "history", "[id]")).toBe(true);
  });
});
