import type { FavouriteFood, FavouriteRecipe, RecipeSummary } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";

type FavouriteList<Entry> = { data: Entry[] | undefined; isSuccess: boolean };

/** What the favourite foods and recipes reads hold. A test sets `data` for a case. */
export const favouriteFoods: { current: FavouriteList<FavouriteFood> } = {
  current: { data: [], isSuccess: true },
};
export const favouriteRecipes: { current: FavouriteList<FavouriteRecipe> } = {
  current: { data: [], isSuccess: true },
};

/** The toggles' `mutateAsync`. A test reads what they were asked, or makes one reject to fail. */
export const mockToggleFavouriteFood = jest.fn<
  Promise<void>,
  [{ food: Food; favourite: boolean }]
>();
export const mockToggleFavouriteRecipe = jest.fn<
  Promise<void>,
  [{ recipe: RecipeSummary; favourite: boolean }]
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
  mockToggleFavouriteFood.mockResolvedValue(undefined);
  mockToggleFavouriteRecipe.mockReset();
  mockToggleFavouriteRecipe.mockResolvedValue(undefined);
  mockUseFavouriteFoods.mockReset();
  mockUseFavouriteFoods.mockImplementation(() => favouriteFoods.current);
  mockUseFavouriteRecipes.mockReset();
  mockUseFavouriteRecipes.mockImplementation(() => favouriteRecipes.current);
}

/** The favourites hooks, to spread into a mock of `@keylow/api-client`. */
export const mockFavouriteHooks = {
  useFavouriteFoods: mockUseFavouriteFoods,
  useFavouriteRecipes: mockUseFavouriteRecipes,
  useToggleFavouriteFood: () => ({ mutateAsync: mockToggleFavouriteFood }),
  useToggleFavouriteRecipe: () => ({ mutateAsync: mockToggleFavouriteRecipe }),
};
