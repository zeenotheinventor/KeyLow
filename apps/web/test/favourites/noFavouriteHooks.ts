/**
 * The favourite hooks of a test that mocks the api-client's hooks and is not about favourites: the favourites
 * have been read and there are none, and a toggle does nothing. Spread it into the mock beside the others.
 */
export const noFavouriteHooks = {
  useFavouriteFoods: () => ({ data: [], isSuccess: true }),
  useFavouriteRecipes: () => ({ data: [], isSuccess: true }),
  useToggleFavouriteFood: () => ({ mutateAsync: () => Promise.resolve() }),
  useToggleFavouriteRecipe: () => ({ mutateAsync: () => Promise.resolve() }),
};
