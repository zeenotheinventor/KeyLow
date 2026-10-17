import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { HttpResponse, http } from "msw";

import { REST_URL, postgrestRows } from "./postgrest";
import { RECIPE_ID, recipeDetailRow } from "./recipes";

import type { Food, FoodPortion } from "@keylow/core/schemas";
import type { SetupServer } from "msw/node";

const chickenAndRice = buildChickenAndRiceRecipe();

/** The three foods of the chicken and rice recipe, as they were when it froze them. */
export const { chicken, rice, oil } = chickenAndRice.foods;

/** What the refresh reads were asked for, in the order the requests arrived. */
export type RefreshReads = {
  recipes: number;
  foodIds: string[];
  foodUrls: URL[];
  portionFoodIds: string[];
  saves: unknown[];
};

type RefreshAnswers = {
  /** The foods the database has now. A food that is not here is not visible to the user. */
  foods: readonly Food[];
  portions?: readonly FoodPortion[];
  /** Holds each food read until it is called, so a test can look at what is in flight. */
  holdFoodReads?: Promise<void>;
};

const idOfFilter = (request: Request, column: string): string =>
  new URL(request.url).searchParams.get(column)?.replace(/^eq\./, "") ?? "";

/**
 * Answers the reads of a refresh: the chicken and rice recipe, then each food and its portions by id.
 * Records what was asked, so a test can say how many requests there were and for what.
 */
export function answerRefreshReads(
  server: SetupServer,
  { foods, portions = [], holdFoodReads }: RefreshAnswers,
): RefreshReads {
  const reads: RefreshReads = {
    recipes: 0,
    foodIds: [],
    foodUrls: [],
    portionFoodIds: [],
    saves: [],
  };
  server.use(
    http.get(`${REST_URL}/recipes`, ({ request }) => {
      reads.recipes += 1;
      return postgrestRows(request, [recipeDetailRow()]);
    }),
    http.get(`${REST_URL}/foods`, async ({ request }) => {
      const id = idOfFilter(request, "id");
      reads.foodIds.push(id);
      reads.foodUrls.push(new URL(request.url));
      await holdFoodReads;
      return postgrestRows(
        request,
        foods.filter((food) => food.id === id),
      );
    }),
    http.get(`${REST_URL}/food_portions`, ({ request }) => {
      const foodId = idOfFilter(request, "food_id");
      reads.portionFoodIds.push(foodId);
      return HttpResponse.json(portions.filter((portion) => portion.food_id === foodId));
    }),
    http.post(`${REST_URL}/rpc/save_recipe`, async ({ request }) => {
      reads.saves.push(await request.clone().json());
      return HttpResponse.json(RECIPE_ID);
    }),
  );
  return reads;
}
