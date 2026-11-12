import { existsSync } from "node:fs";
import { join } from "node:path";

import { assistantCardHref } from "../lib/assistantCardRoutes";

const RECIPE_ID = "00000000-0000-4000-8000-0000000000e1";
const FOOD_ID = "00000000-0000-4000-8000-0000000000f1";
const ROUTINE_ID = "00000000-0000-4000-8000-0000000000e2";
const SESSION_ID = "00000000-0000-4000-8000-0000000000e3";

// The files an address needs under app/, so a rename that leaves a card's link opening the not-found screen fails here.
const appDirectory = join(__dirname, "..", "app");
const routeFileExists = (...segments: string[]) =>
  [".tsx", ".ts"].some((extension) => existsSync(join(appDirectory, ...segments) + extension)) ||
  [".tsx", ".ts"].some((extension) =>
    existsSync(join(appDirectory, ...segments, `index${extension}`)),
  );

describe("assistantCardHref", () => {
  it("should open the recipe editor for the recipe", () => {
    expect(assistantCardHref({ screen: "recipe_editor", recipeId: RECIPE_ID })).toBe(
      `/recipes/${RECIPE_ID}/edit`,
    );
    expect(routeFileExists("recipes", "[id]", "edit")).toBe(true);
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
    expect(routeFileExists("foods", "[id]")).toBe(true);
  });

  it("should open the diary on the day", () => {
    expect(assistantCardHref({ screen: "diary_day", localDate: "2026-10-24" })).toBe(
      "/diary?day=2026-10-24",
    );
    expect(routeFileExists("(tabs)", "diary")).toBe(true);
  });

  it("should open the routine in its editor", () => {
    expect(assistantCardHref({ screen: "routine_editor", routineId: ROUTINE_ID })).toBe(
      `/train/routines/${ROUTINE_ID}`,
    );
    expect(routeFileExists("(tabs)", "train", "routines", "[id]")).toBe(true);
  });

  it("should open the logged session", () => {
    expect(assistantCardHref({ screen: "session_detail", sessionId: SESSION_ID })).toBe(
      `/train/history/${SESSION_ID}`,
    );
    expect(routeFileExists("(tabs)", "train", "history", "[id]")).toBe(true);
  });
});
