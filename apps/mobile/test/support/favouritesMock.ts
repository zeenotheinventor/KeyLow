import type { FavouriteFood, FavouriteRecipe, RecipeSummary } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";

type FavouriteList<Entry> = { data: Entry[] | undefined; isSuccess: boolean };

type Callbacks = { onError?: (error: Error) => void };

/** What the favourite foods and recipes reads hold. A test sets `data` for a case. */
export const favouriteFoods: { current: FavouriteList<FavouriteFood> } = {
  current: { data: [], isSuccess: true },
};
export const favouriteRecipes: { current: FavouriteList<FavouriteRecipe> } = {
  current: { data: [], isSuccess: true },
};

/** The toggles' `mutate`. A test reads what they were asked, or makes one fail through `onError`. */
export const mockToggleFavouriteFood = jest.fn<
  unknown,
  [{ food: Food; favourite: boolean }, Callbacks?]
>();
export const mockToggleFavouriteRecipe = jest.fn<
  unknown,
  [{ recipe: RecipeSummary; favourite: boolean }, Callbacks?]
>();
export const mockUseFavouriteFoods = jest.fn<
  FavouriteList<FavouriteFood>,
  [{ enabled?: boolean }?]
>();
export const mockUseFavouriteRecipes = jest.fn<
  FavouriteList<FavouriteRecipe>,
  [{ enabled?: boolean }?]
>();

export function resetFavouritesMock(): void {
  favouriteFoods.current = { data: [], isSuccess: true };
  favouriteRecipes.current = { data: [], isSuccess: true };
  mockToggleFavouriteFood.mockReset();
  mockToggleFavouriteRecipe.mockReset();
  mockUseFavouriteFoods.mockReset();
  mockUseFavouriteFoods.mockImplementation(() => favouriteFoods.current);
  mockUseFavouriteRecipes.mockReset();
  mockUseFavouriteRecipes.mockImplementation(() => favouriteRecipes.current);
}

/** The favourites hooks, to spread into a mock of `@keylow/api-client`. */
export const mockFavouriteHooks = {
  useFavouriteFoods: mockUseFavouriteFoods,
  useFavouriteRecipes: mockUseFavouriteRecipes,
  useToggleFavouriteFood: () => ({ mutate: mockToggleFavouriteFood }),
  useToggleFavouriteRecipe: () => ({ mutate: mockToggleFavouriteRecipe }),
};
